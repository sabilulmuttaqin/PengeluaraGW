import { View, TextInput, Modal, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/nativewindui/Text';
import { Icon } from '@/components/nativewindui/Icon';
import { useState, useMemo } from 'react';
import { parseExpenseText } from '@/utils/gemini';
import { router } from 'expo-router';
import { useExpenseStore, TransactionType } from '@/store';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

interface SmartTextModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SmartTextModal({ visible, onClose }: SmartTextModalProps) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { categories, addExpense } = useExpenseStore();
  const db = useSQLiteContext();
  const { t } = useTranslation();

  // Separate expense and income categories
  const expenseCategories = useMemo(() => 
    categories.filter(c => c.category_type !== 'income').map(c => c.name), 
    [categories]
  );
  const incomeCategories = useMemo(() => 
    categories.filter(c => c.category_type === 'income').map(c => c.name), 
    [categories]
  );

  const handleParse = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      // Pass both expense and income category names
      const result = await parseExpenseText(input, expenseCategories, incomeCategories);
      
      if (!result) {
        Alert.alert(t('common.error'), t('smartText.parseError'));
        setLoading(false);
        return;
      }

      // Validasi: Pastikan nominal ada dan valid
      if (!result.amount || result.amount <= 0) {
        Alert.alert(t('smartText.invalidAmount'), t('smartText.invalidAmountDesc'));
        setLoading(false);
        return;
      }

      // Validasi: Pastikan nama item ada
      if (!result.name || result.name.trim() === '') {
        Alert.alert(t('smartText.emptyName'), t('smartText.emptyNameDesc'));
        setLoading(false);
        return;
      }

      // Find matching category based on type
      const categoryList = result.type === 'income' 
        ? categories.filter(c => c.category_type === 'income')
        : categories.filter(c => c.category_type !== 'income');
      
      const category = categoryList.find(c => 
        c.name.toLowerCase() === result.category.toLowerCase()
      );

      if (!category) {
        const typeLabel = result.type === 'income' ? t('transaction.income') : t('transaction.expense');
        Alert.alert(t('smartText.categoryNotFound'), `"${result.category}" ${typeLabel.toLowerCase()}`);
        setLoading(false);
        return;
      }

      // Add expense/income directly
      await addExpense(db, {
        amount: result.amount,
        category_id: category.id,
        date: new Date().toISOString(),
        note: result.name,
        type: result.type || 'expense'
      });

      // Show success and close
      const typeLabel = result.type === 'income' ? t('smartText.successIncome') : t('smartText.successExpense');
      const sign = result.type === 'income' ? '+' : '-';
      Alert.alert(t('common.success'), `${typeLabel}: ${result.name}\n${sign}Rp ${result.amount.toLocaleString('id-ID')}`);
      setInput('');
      onClose();
    } catch (error) {
      console.error('Error in smart text:', error);
      Alert.alert(t('common.error'), t('smartText.parseError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
      >
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <View className="bg-white dark:bg-gray-900 rounded-t-[32px] p-6" style={{ paddingBottom: Math.max(insets.bottom + 20, 24) }}>
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold">{t('smartText.title')}</Text>
            <Pressable onPress={onClose} className="p-2 bg-gray-100 rounded-full dark:bg-gray-800">
              <Icon name="xmark" size={16} color="gray" />
            </Pressable>
          </View>

          {/* Info */}
          <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl mb-4">
            <Text className="text-sm text-blue-900 dark:text-blue-100 mb-2">
              💡 {t('smartText.placeholder')}
            </Text>
          </View>

          {/* Input */}
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('smartText.placeholder')}
            placeholderTextColor="#9CA3AF"
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-lg font-medium font-sans mb-6 text-black dark:text-white"
            autoFocus
            editable={!loading}
          />

          {/* Button */}
          <Pressable 
            onPress={handleParse}
            disabled={loading || !input.trim()}
            className={`w-full py-4 rounded-full items-center justify-center ${
              loading || !input.trim() ? 'bg-gray-200 dark:bg-gray-700' : 'bg-black dark:bg-white'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-lg ${
                loading || !input.trim() ? 'text-gray-400' : 'text-white dark:text-black'
              }`}>
                {t('smartText.process')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
