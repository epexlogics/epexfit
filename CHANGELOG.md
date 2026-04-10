# CHANGELOG — EpexFit Social System Fix

## Root Causes Identified & Fixed

### 1. Followers / Following Lists Were Empty
**File:** `src/services/socialService.ts`

**Root cause:** The Supabase FK-hint join syntax `profiles!follower_id` silently returns `null`
when the foreign key constraint name in the database doesn't exactly match the hint string.
This caused every profile in the followers/following list to be `null`, so the list appeared empty
even though the count was correct (count queries don't use joins).

**Fix:** Replaced the single-query FK-hint join with a reliable two-step approach:
1. Fetch the follower/following IDs from the `follows` table
2. Fetch profiles by those IDs using `.in('id', ids)`

This is now encapsulated in the shared `fetchProfilesById()` helper used throughout the service.

---

### 2. Comments List Was Empty (Count Showed Correctly)
**File:** `src/services/socialService.ts`

**Root cause:** Same FK-hint join issue — `profiles!user_id` in the `feed_comments` select
was silently returning null for the profile join, so `userName` and `userAvatar` were always
undefined. Additionally, the comment count used a subquery aggregate that could mismatch
the actual list fetch.

**Fix:**
- `getComments()` now fetches comments first, then fetches profiles separately via `fetchProfilesById()`
- Like/comment counts throughout now use flat row fetches + client-side counting maps
  instead of Supabase aggregate subqueries (which return arrays, not numbers, and require
  careful unwrapping that was inconsistently done)

---

### 3. Feed Showed Random / Irrelevant Posts
**File:** `src/services/socialService.ts`

**Root cause:** The feed query relied solely on Supabase RLS to filter posts. If RLS was
misconfigured or the `activity_feed` policy wasn't applied, all posts were visible.
Additionally, the `actorIds` array construction was correct but the RLS policy needed
to be verified.

**Fix:**
- `getFeed()` now explicitly passes `.in('actor_id', actorIds)` as a belt-and-suspenders
  filter alongside RLS — even if RLS is misconfigured, the app-level filter ensures only
  followed users' posts appear
- Migration `20240103000000_social_system_fix.sql` recreates the `feed_select` RLS policy
  with the correct filter

---

### 4. Like / Comment Counts Mismatched Actual Data
**File:** `src/services/socialService.ts`

**Root cause:** The original code used Supabase aggregate subqueries like
`like_count:feed_likes(count)` which returns an array `[{count: "3"}]` — a string inside
an array. The unwrapping code `Array.isArray(p.like_count) ? (p.like_count[0]?.count ?? 0) : 0`
was fragile and could return 0 when the count was non-zero.

**Fix:** Replaced all aggregate subqueries with flat row fetches + client-side count maps:
```
const likeCountMap: Record<string, number> = {};
(likesRes.data ?? []).forEach(r => {
  likeCountMap[r.feed_item_id] = (likeCountMap[r.feed_item_id] ?? 0) + 1;
});
```
This is deterministic and matches exactly what's in the database.

---

### 5. No Manual Post Creation UI
**Files added:** `src/screens/main/CreatePostScreen.tsx`
**Files modified:** `src/navigation/MainNavigator.tsx`, `src/screens/main/SocialFeedScreen.tsx`,
`src/screens/main/ProfileScreen.tsx`, `src/screens/main/PhotoLogScreen.tsx`

**Root cause:** There was no screen for users to create manual text/image posts.
The `socialService.createPost()` method existed but was never called from any UI.

**Fix:**
- Added `CreatePostScreen` — supports text + optional image, 500 char limit
- Registered as a modal stack screen (`presentation: 'modal'`) in `MainNavigator`
- Added "✏️ Post" button to `SocialFeedScreen` header
- Added "Create Post" button to `ProfileScreen` hero card
- After saving activity photo in `PhotoLogScreen`, user is offered "Share to Feed"
  which opens `CreatePostScreen` pre-filled with the activity ID (uses `shareActivity()`)

---

### 6. User Search Inconsistency
**File:** `src/services/socialService.ts`

**Root cause:** When `myId` was null (edge case), the `.neq('id', null)` filter was
passed which in PostgreSQL evaluates differently than expected (NULL comparisons).

**Fix:** Changed to `.neq('id', '00000000-0000-0000-0000-000000000000')` as a safe
fallback UUID that will never match a real user, ensuring the query always works correctly.

---

### 7. Database Schema Gaps
**File added:** `supabase/migrations/20240103000000_social_system_fix.sql`

**Root cause:** Several tables may not have existed or had missing indexes/constraints,
causing silent query failures.

**Fix:** Migration that:
- Ensures `profiles` has all required columns (`username`, `bio`, `is_private`, etc.)
- Ensures `follows`, `activity_feed`, `feed_likes`, `feed_comments` tables exist with
  correct structure, indexes, and RLS policies
- Adds a `handle_new_user()` trigger to auto-create a `profiles` row on signup
- Backfills `profiles` rows for existing users who have no profile row
- Enables Realtime for all social tables

---

## Files Modified

| File | Change |
|------|--------|
| `src/services/socialService.ts` | Complete rewrite of data fetching — two-step queries, count maps, fixed search |
| `src/screens/main/SocialFeedScreen.tsx` | Added Create Post button, social_post card rendering, image display |
| `src/screens/main/ProfileScreen.tsx` | Added Create Post button to hero card |
| `src/screens/main/PhotoLogScreen.tsx` | Added "Share to Feed" option after saving activity photo |
| `src/navigation/MainNavigator.tsx` | Registered CreatePostScreen as modal route |

## Files Added

| File | Purpose |
|------|---------|
| `src/screens/main/CreatePostScreen.tsx` | New screen for creating manual posts + sharing activities |
| `supabase/migrations/20240103000000_social_system_fix.sql` | DB schema fixes, RLS policies, auto-profile trigger |

## Files Removed

None — all original files preserved.

---

## How to Apply the Database Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Paste and run the contents of `supabase/migrations/20240103000000_social_system_fix.sql`

Or via CLI:
```bash
supabase db push
```

---

## Verification Checklist

After applying:
- [ ] Follow a user → their posts appear in your feed
- [ ] Unfollow → their posts disappear from feed
- [ ] Tap Followers count → list shows real users (not empty)
- [ ] Tap Following count → list shows real users (not empty)
- [ ] Add a comment → comment appears in list, count matches
- [ ] Delete a comment → count decreases, item removed from list
- [ ] Like a post → count increments, heart fills
- [ ] Search by name → results appear
- [ ] Search by @username → results appear
- [ ] Create Post → post appears in feed immediately
- [ ] Share activity from PhotoLog → activity post appears in feed
