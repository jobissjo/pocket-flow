import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalSheet } from '../ui/modal-sheet';
import { CustomInput } from '../ui/custom-input';
import { SegmentedControl } from '../ui/segmented-control';
import { categoryService } from '@/services/categories';
import { CategoryType, CategoryResponse } from '@/services/types';
import { useTheme } from '@/services/theme-context';
import { hapticNotificationSuccess, hapticLight } from '@/services/haptics';

interface CategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newCat?: CategoryResponse) => void;
  defaultType?: CategoryType;
}

const ICONS: Array<keyof typeof Ionicons.glyphMap> = [
  'cart-outline',
  'restaurant-outline',
  'car-outline',
  'home-outline',
  'medkit-outline',
  'film-outline',
  'airplane-outline',
  'wallet-outline',
  'cash-outline',
  'card-outline',
  'gift-outline',
  'school-outline',
  'briefcase-outline',
  'fitness-outline',
  'game-controller-outline',
  'musical-notes-outline',
  'shirt-outline',
  'phone-portrait-outline',
  'wifi-outline',
  'beer-outline',
];

export function CategoryFormModal({
  visible,
  onClose,
  onSuccess,
  defaultType = 'expense',
}: CategoryFormModalProps) {
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(defaultType);
  const [selectedIcon, setSelectedIcon] = useState<string>('cart-outline');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const created = await categoryService.createCategory({
        name: name.trim(),
        type,
        icon: selectedIcon,
      });
      hapticNotificationSuccess();
      setName('');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="New Category"
      subtitle="Create a custom transaction category"
    >
      <View style={styles.container}>
        <SegmentedControl
          options={[
            { label: 'Expense', value: 'expense' },
            { label: 'Income', value: 'income' },
          ]}
          value={type}
          onChange={(val) => setType(val as CategoryType)}
          style={{ marginBottom: 16 }}
        />

        <CustomInput
          label="Category Name"
          placeholder="e.g. Subscriptions, Groceries"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          leftIcon="pricetag-outline"
          error={error || undefined}
        />

        <Text
          style={[
            styles.sectionLabel,
            { color: isDark ? '#94A3B8' : '#475569' },
          ]}
        >
          Select Icon
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.iconScroll}
          contentContainerStyle={styles.iconContainer}
        >
          {ICONS.map((iconName) => {
            const isSelected = selectedIcon === iconName;
            return (
              <TouchableOpacity
                key={iconName}
                onPress={() => {
                  hapticLight();
                  setSelectedIcon(iconName);
                }}
                style={[
                  styles.iconButton,
                  {
                    backgroundColor: isSelected
                      ? '#2563EB'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9',
                    borderColor: isSelected
                      ? '#60A5FA'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : '#E2E8F0',
                  },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={22}
                  color={isSelected ? '#FFFFFF' : isDark ? '#E2E8F0' : '#475569'}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !name.trim()}
          style={[
            styles.submitButton,
            {
              backgroundColor:
                loading || !name.trim()
                  ? isDark
                    ? '#1E293B'
                    : '#CBD5E1'
                  : '#2563EB',
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Create Category</Text>
          )}
        </TouchableOpacity>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  iconScroll: {
    marginBottom: 20,
  },
  iconContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
