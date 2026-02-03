import { View, Modal, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { Text } from '@/components/nativewindui/Text';
import { Icon } from '@/components/nativewindui/Icon';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { parseExpenseImage } from '@/utils/gemini';
import { useExpenseStore } from '@/store';
import { useSQLiteContext } from 'expo-sqlite';
import { useColorScheme } from '@/lib/useColorScheme';

interface OCRModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OCRModal({ visible, onClose }: OCRModalProps) {
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { categories, addExpense } = useExpenseStore();
  const db = useSQLiteContext();
  const { colorScheme } = useColorScheme();

  const pickImage = async (useCamera: boolean) => {
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed to scan receipts.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Media library permission is needed.');
          return;
        }
      }

      // Launch camera or picker with editing enabled
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.9,
            base64: true,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.9,
            base64: true,
            exif: false,
          });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        setImageBase64(result.assets[0].base64 || null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleParse = async () => {
    if (!image) return;

    setLoading(true);
    try {
      // Get category names from DB
      const categoryNames = categories.map(c => c.name);
      
      // Pass base64 if available to avoid FileSystem read issues
      const results = await parseExpenseImage(image, categoryNames, true, imageBase64); 
      
      if (!results || results.length === 0) {
        Alert.alert('Gagal Parse', 'Tidak bisa membaca struk. Pastikan foto jelas dan ada informasi total.');
        setLoading(false);
        return;
      }

      // Process each expense
      let addedCount = 0;
      const failedItems: string[] = [];

      for (const result of results) {
        // Find matching category
        const category = categories.find(c => 
          c.name.toLowerCase() === result.category.toLowerCase()
        );

        if (!category) {
          failedItems.push(result.name);
          continue;
        }

        // Add expense
        try {
          await addExpense(db, {
            amount: result.amount,
            category_id: category.id,
            date: new Date().toISOString(),
            note: result.name
          });
          addedCount++;
        } catch (err) {
          failedItems.push(result.name);
        }
      }

      // Show result
      if (addedCount > 0) {
        const message = results.length === 1
          ? `${results[0].name} - Rp ${results[0].amount.toLocaleString('id-ID')} berhasil ditambahkan!`
          : `${addedCount} item berhasil ditambahkan!${failedItems.length > 0 ? `\n\nGagal: ${failedItems.join(', ')}` : ''}`;
        
        Alert.alert('Berhasil!', message);
        setImage(null);
        onClose();
      } else {
        Alert.alert('Gagal', 'Tidak ada item yang bisa ditambahkan. Pastikan kategori tersedia.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error in OCR parsing:', error);
      Alert.alert('Error', 'Terjadi kesalahan. Pastikan koneksi internet aktif.');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setImage(null);
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
        <View className="bg-white dark:bg-gray-900 rounded-t-[32px] p-6 pb-10 h-[85%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold">Scan Receipt</Text>
            <Pressable onPress={handleClose} className="p-2 bg-gray-100 rounded-full dark:bg-gray-800">
              <Icon name="xmark" size={16} color="gray" />
            </Pressable>
          </View>

          {/* Info */}
          {!image && (
            <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl mb-6">
              <Text className="text-sm text-blue-900 dark:text-blue-100 mb-2">
                📸 Tips untuk hasil terbaik:
              </Text>
              <Text className="text-xs text-blue-700 dark:text-blue-300">
                • Pastikan foto jelas dan terang{'\n'}
                • Total amount harus terlihat{'\n'}
                • Hindari bayangan atau refleksi
              </Text>
            </View>
          )}

          {/* Image Preview */}
          {image ? (
            <View className="flex-1 mb-6">
              <Image 
                source={{ uri: image }} 
                className="w-full h-full rounded-2xl"
                resizeMode="contain"
              />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center mb-6">
              <Icon name="camera" size={80} color="#9CA3AF" />
              <Text className="text-gray-400 mt-4">No image selected</Text>
            </View>
          )}

          {/* Buttons */}
          {!image ? (
            <View className="gap-3">
              <Pressable 
                onPress={() => pickImage(true)}
                className="w-full py-4 rounded-full items-center justify-center bg-black dark:bg-white flex-row gap-2"
              >
              <Icon name="camera.fill" size={20} color={colorScheme === 'dark' ? 'black' : 'white'} />
                <Text className="font-bold text-lg text-white dark:text-black">
                  Take Photo
                </Text>
              </Pressable>

              <Pressable 
                onPress={() => pickImage(false)}
                className="w-full py-4 rounded-full items-center justify-center bg-gray-200 dark:bg-gray-700 flex-row gap-2"
              >
                <Icon name="photo.fill" size={20} color={colorScheme === 'dark' ? 'white' : 'black'} />
                <Text className="font-bold text-lg text-gray-700 dark:text-gray-200">
                  Choose from Gallery
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              <Pressable 
                onPress={handleParse}
                disabled={loading}
                className={`w-full py-4 rounded-full items-center justify-center ${
                  loading ? 'bg-gray-200 dark:bg-gray-700' : 'bg-black dark:bg-white'
                }`}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-bold text-lg text-white dark:text-black">
                    Parse & Add Expense
                  </Text>
                )}
              </Pressable>

              <Pressable 
                onPress={() => setImage(null)}
                disabled={loading}
                className="w-full py-4 rounded-full items-center justify-center bg-gray-200 dark:bg-gray-700"
              >
                <Text className="font-bold text-lg text-gray-700 dark:text-gray-200">
                  Retake
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
