import { View, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/nativewindui/Text';
import { Icon } from '@/components/nativewindui/Icon';
import { useState, useEffect } from 'react';
import { parseExpenseText } from '@/utils/gemini';
import { useExpenseStore } from '@/store';
import { useSQLiteContext } from 'expo-sqlite';
import { useColorScheme } from '@/lib/useColorScheme';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from '@jamsch/expo-speech-recognition';

interface VoiceModalProps {
  visible: boolean;
  onClose: () => void;
}

export function VoiceModal({ visible, onClose }: VoiceModalProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const { categories, addExpense } = useExpenseStore();
  const db = useSQLiteContext();

  // Handle speech recognition results
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript || '';
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error, event.message);
    setIsListening(false);
    if (event.error !== 'no-speech') {
      Alert.alert('Error', 'Gagal mengenali suara. Coba lagi.');
    }
  });

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setTranscript('');
      setIsListening(false);
      setLoading(false);
    }
  }, [visible]);

  const startListening = async () => {
    try {
      // Check and request permissions
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Izin mikrofon diperlukan untuk voice input.');
        return;
      }

      setTranscript('');
      setIsListening(true);
      
      // Start speech recognition
      ExpoSpeechRecognitionModule.start({
        lang: 'id-ID', // Indonesian
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
      });
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      Alert.alert('Error', 'Tidak bisa memulai voice recognition.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
  };

  const handleParse = async () => {
    if (!transcript.trim()) {
      Alert.alert('Input Kosong', 'Belum ada teks yang terdeteksi. Coba bicara lagi.');
      return;
    }

    setLoading(true);
    try {
      const categoryNames = categories.map(c => c.name);
      const result = await parseExpenseText(transcript, categoryNames);
      
      if (!result) {
        Alert.alert('Gagal Parse', 'Tidak bisa memahami input. Coba format: "Nasi goreng 15rb"');
        setLoading(false);
        return;
      }

      // Validate amount
      if (!result.amount || result.amount <= 0) {
        Alert.alert(
          'Nominal Tidak Valid', 
          'Nominal pengeluaran tidak terdeteksi atau bernilai 0.\n\nCoba ucapkan dengan nominal seperti:\n• "Nasi goreng 15ribu"\n• "Kopi 12000"\n• "Bensin 50000"'
        );
        setLoading(false);
        return;
      }

      // Validate name
      if (!result.name || result.name.trim() === '') {
        Alert.alert('Nama Item Kosong', 'Nama pengeluaran tidak terdeteksi. Coba ucapkan nama item dan nominal.');
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

      // Add expense
      await addExpense(db, {
        amount: result.amount,
        category_id: category.id,
        date: new Date().toISOString(),
        note: result.name
      });

      // Show success and close
      Alert.alert('Berhasil!', `${result.name} - Rp ${result.amount.toLocaleString('id-ID')} ditambahkan ke ${category.name}`);
      setTranscript('');
      onClose();
    } catch (error) {
      console.error('Error in voice parse:', error);
      Alert.alert('Error', 'Terjadi kesalahan. Pastikan koneksi internet aktif.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
    }
    setTranscript('');
    setIsListening(false);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={handleClose} />
        <View className="bg-white dark:bg-gray-900 rounded-t-[32px] p-6" style={{ paddingBottom: Math.max(insets.bottom + 20, 24) }}>
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold">Voice Input</Text>
            <Pressable onPress={handleClose} className="p-2 bg-gray-100 rounded-full dark:bg-gray-800">
              <Icon name="xmark" size={16} color="gray" />
            </Pressable>
          </View>

          {/* Info */}
          <View className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl mb-4">
            <Text className="text-sm text-purple-900 dark:text-purple-100 mb-2">
              🎤 Ucapkan pengeluaran Anda:
            </Text>
            <Text className="text-xs text-purple-700 dark:text-purple-300">
              • "Nasi goreng 15ribu"{'\n'}
              • "Bensin 50000"{'\n'}
              • "Kopi 12ribu"
            </Text>
          </View>

          {/* Mic Button */}
          <View className="items-center my-6">
            <Pressable
              onPress={isListening ? stopListening : startListening}
              disabled={loading}
              className={`w-24 h-24 rounded-full items-center justify-center ${
                isListening 
                  ? 'bg-red-500' 
                  : 'bg-black dark:bg-white'
              }`}
            >
              <Icon 
                name={isListening ? 'stop.fill' : 'mic.fill'} 
                size={40} 
                color={isListening ? 'white' : (colorScheme === 'dark' ? 'black' : 'white')} 
              />
            </Pressable>
            <Text className="mt-3 text-sm text-gray-500">
              {isListening ? 'Tap untuk berhenti' : 'Tap untuk bicara'}
            </Text>
          </View>

          {/* Transcript Display */}
          <View className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 min-h-[60px] mb-6">
            {transcript ? (
              <Text className="text-lg font-medium">{transcript}</Text>
            ) : (
              <Text className="text-gray-400 text-lg">
                {isListening ? 'Mendengarkan...' : 'Hasil suara akan muncul di sini'}
              </Text>
            )}
          </View>

          {/* Parse Button */}
          <Pressable 
            onPress={handleParse}
            disabled={loading || !transcript.trim()}
            className={`w-full py-4 rounded-full items-center justify-center ${
              loading || !transcript.trim() ? 'bg-gray-200 dark:bg-gray-700' : 'bg-black dark:bg-white'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className={`font-bold text-lg ${
                loading || !transcript.trim() ? 'text-gray-400' : 'text-white dark:text-black'
              }`}>
                Parse & Add
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
