// ─── Dayjs plugins — must be registered FIRST before any module uses dayjs ───
// Production APK mein module load order different hota hai Expo Go se.
// Agar koi screen dayjs import kare plugins register hone se pehle,
// isoWeek / relativeTime undefined hoti hai → "undefined is not a function" crash.
import './src/utils/dayjs';

import { registerRootComponent } from 'expo';
import App from './src/App';

registerRootComponent(App);
