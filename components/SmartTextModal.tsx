import { View, TextInput, Modal, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/nativewindui/Text';
import { Icon } from '@/components/nativewindui/Icon';
import { useState } from 'react';
import { parseExpenseText } from '@/utils/gemini';
import { router } from 'expo-router';
import { useExpenseStore } from '@/store/expenseStore';
import { useSQLiteContext } from 'expo-sqlite';

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

  const handleParse = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      // Get category names from DB
      const categoryNames = categories.map(c => c.name);
      const result = await parseExpenseText(input, categoryNames);
      
      if (!result) {
        Alert.alert('Gagal Parse', 'Tidak bisa memahami input. Coba format: "Nasi goreng 15rb"');
        setLoading(false);
        return;
      }

      // Validasi: Pastikan nominal ada dan valid
      if (!result.amount || result.amount <= 0) {
        Alert.alert(
          'Nominal Tidak Valid', 
          'Nominal pengeluaran tidak terdeteksi atau bernilai 0.\n\nCoba tambahkan nominal seperti:\n• "Nasi goreng 15rb"\n• "Kopi 12000"\n• "Bensin 50ribu"'
        );
        setLoading(false);
        return;
      }

      // Validasi: Pastikan nama item ada
      if (!result.name || result.name.trim() === '') {
        Alert.alert(
          'Nama Item Kosong', 
          'Nama pengeluaran tidak terdeteksi. Coba masukkan nama item dan nominal.'
        );
        setLoading(false);
        return;
      }

      // Find matching category
      const category = categories.find(c => 
        c.name.toLowerCase() === result.category.toLowerCase()
      );

      if (!category) {
        Alert.alert('Kategori Tidak Ditemukan', `Kategori "${result.category}" tidak tersedia. Silakan tambahkan dulu.`);
        setLoading(false);
        return;
      }

      // Add expense directly
      await addExpense(db, {
        amount: result.amount,
        category_id: category.id,
        date: new Date().toISOString(),
        note: result.name
      });

      // Show success and close
      Alert.alert('Berhasil!', `${result.name} - Rp ${result.amount.toLocaleString('id-ID')} ditambahkan ke ${category.name}`);
      setInput('');
      onClose();
    } catch (error) {
      console.error('Error in smart text:', error);
      Alert.alert('Error', 'Terjadi kesalahan. Pastikan koneksi internet aktif.');
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
            <Text className="text-xl font-bold">Smart Text</Text>
            <Pressable onPress={onClose} className="p-2 bg-gray-100 rounded-full dark:bg-gray-800">
              <Icon name="plus" size={16} color="gray" />
            </Pressable>
          </View>

          {/* Info */}
          <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl mb-4">
            <Text className="text-sm text-blue-900 dark:text-blue-100 mb-2">
              💡 Contoh input:
            </Text>
            <Text className="text-xs text-blue-700 dark:text-blue-300">
              • "Nasi goreng 15rb"{'\n'}
              • "Bensin 50000"{'\n'}
              • "Kopi 12ribu"
            </Text>
          </View>

          {/* Input */}
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="e.g., Nasi goreng 15rb"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-lg font-medium mb-6 text-black dark:text-white"
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
                Parse & Add
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
