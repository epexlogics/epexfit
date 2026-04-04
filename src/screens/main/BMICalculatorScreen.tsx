import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AppIcon from '../../components/AppIcon';
import { borderRadius, spacing } from '../../constants/theme';

export default function BMICalculatorScreen() {
  const { user, updateProfile } = useAuth();
  const { colors } = useTheme();
  const [height, setHeight] = useState(user?.height?.toString() ?? '');
  const [weight, setWeight] = useState(user?.weight?.toString() ?? '');
  const [bmi, setBmi] = useState<number | null>(null);
  const [category, setCategory] = useState('');
  const [advice, setAdvice] = useState('');

  useEffect(() => {
    if (user?.height && user?.weight) calculateBMI();
  }, []);

  const calculateBMI = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) {
      Alert.alert('Error', 'Please enter valid height and weight');
      return;
    }
    const hm = h / 100;
    const val = w / (hm * hm);
    setBmi(val);

    if (val < 18.5) {
      setCategory('Underweight');
      setAdvice('Consider increasing your calorie intake with nutrient-rich foods. Consult a nutritionist for a personalized plan.');
    } else if (val < 25) {
      setCategory('Normal weight');
      setAdvice('Great job! Maintain your healthy lifestyle with balanced diet and regular exercise.');
    } else if (val < 30) {
      setCategory('Overweight');
      setAdvice('Focus on portion control and increase physical activity. Aim for 30 minutes of exercise daily.');
    } else {
      setCategory('Obese');
      setAdvice('Consult a healthcare provider for a weight management plan. Start with moderate exercise and healthy eating.');
    }

    if (user) updateProfile({ height: h, weight: w });
  };

  const getBMIColor = () => {
    if (!bmi) return colors.textSecondary;
    if (bmi < 18.5) return '#2196F3';
    if (bmi < 25) return '#4CAF50';
    if (bmi < 30) return '#FFC107';
    return '#F44336';
  };

  const bmiColor = getBMIColor();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scroll}>
      {/* Input card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>BMI Calculator</Text>

        {[
          { icon: 'human-male-height', value: height, setter: setHeight, placeholder: 'Height (cm)', color: '#2196F3' },
          { icon: 'weight', value: weight, setter: setWeight, placeholder: 'Weight (kg)', color: '#FF9800' },
        ].map((field) => (
          <View key={field.placeholder} style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: field.color + '20' }]}>
              <AppIcon name={field.icon} size={20} color={field.color} />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textDisabled}
              value={field.value}
              onChangeText={field.setter}
              keyboardType="numeric"
            />
          </View>
        ))}

        <TouchableOpacity style={[styles.calcBtn, { backgroundColor: colors.primary }]} onPress={calculateBMI}>
          <Text style={styles.calcBtnText}>Calculate BMI</Text>
        </TouchableOpacity>
      </View>

      {/* Result */}
      {bmi !== null && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
          <View style={[styles.bmiCircle, { borderColor: bmiColor }]}>
            <Text style={[styles.bmiValue, { color: bmiColor }]}>{bmi.toFixed(1)}</Text>
            <Text style={[styles.bmiCategory, { color: bmiColor }]}>{category}</Text>
          </View>

          <View style={[styles.adviceCard, { backgroundColor: bmiColor + '18' }]}>
            <AppIcon name="lightbulb" size={22} color={bmiColor} />
            <Text style={[styles.adviceText, { color: colors.textSecondary }]}>{advice}</Text>
          </View>

          {/* BMI scale */}
          <View style={styles.scaleWrap}>
            <View style={styles.scaleBar}>
              {['#2196F3', '#4CAF50', '#FFC107', '#F44336'].map((c) => (
                <View key={c} style={[styles.scaleSegment, { backgroundColor: c }]} />
              ))}
            </View>
            <View style={styles.scaleLabels}>
              {['Underweight', 'Normal', 'Overweight', 'Obese'].map((label) => (
                <Text key={label} style={[styles.scaleLabel, { color: colors.textSecondary }]}>{label}</Text>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Info card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>What is BMI?</Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Body Mass Index (BMI) is a measure of body fat based on height and weight. It's used to screen for weight categories that may lead to health problems.
        </Text>
        <Text style={[styles.infoTitle, { color: colors.text, marginTop: 16 }]}>BMI Categories</Text>
        {[
          { color: '#2196F3', label: 'Underweight: BMI < 18.5' },
          { color: '#4CAF50', label: 'Normal: BMI 18.5 – 24.9' },
          { color: '#FFC107', label: 'Overweight: BMI 25 – 29.9' },
          { color: '#F44336', label: 'Obese: BMI ≥ 30' },
        ].map((item) => (
          <View key={item.label} style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
            <Text style={[styles.categoryText, { color: colors.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  card: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, gap: 16 },
  cardTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  calcBtn: { height: 56, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  calcBtnText: { color: '#000000', fontSize: 16, fontWeight: '800' },
  bmiCircle: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  bmiValue: { fontSize: 48, fontWeight: '900' },
  bmiCategory: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  adviceCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: borderRadius.lg, gap: 10, width: '100%' },
  adviceText: { flex: 1, fontSize: 13, lineHeight: 20 },
  scaleWrap: { width: '100%', gap: 8 },
  scaleBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  scaleSegment: { flex: 1 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { fontSize: 10 },
  infoTitle: { fontSize: 16, fontWeight: '700' },
  infoText: { fontSize: 13, lineHeight: 20 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryText: { fontSize: 13 },
});
