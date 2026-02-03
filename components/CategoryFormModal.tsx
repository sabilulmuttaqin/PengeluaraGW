import { View, TextInput, Modal, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from '@/components/nativewindui/Text';
import { Icon } from '@/components/nativewindui/Icon';
import { useState, useEffect } from 'react';
import { COLORS } from '@/theme/colors';
import { CustomAlertModal, AlertButton } from '@/components/CustomAlertModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CategoryFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (category: { name: string; icon: string; color: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  initialData?: {
    name: string;
    icon: string;
    color: string;
  };
  mode: 'add' | 'edit';
}

export function CategoryFormModal({ visible, onClose, onSave, onDelete, initialData, mode }: CategoryFormModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#000000'); // Default to black as requested for simplicity or specific color
  const [isValidEmoji, setIsValidEmoji] = useState(true);

  // Alert Config
  const [alertConfig, setAlertConfig] = useState<{
      visible: boolean;
      title: string;
      message: string;
      buttons?: AlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [] });

  // Function to check if string contains only emoji
  const isEmoji = (str: string) => {
    if (!str) return true; // Empty is valid (will show placeholder)
    // Regex to match emoji characters
    const emojiRegex = /^(\p{Emoji}|\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}|\p{Extended_Pictographic})+$/u;
    return emojiRegex.test(str);
  };

  useEffect(() => {
    if (visible) {
      if (initialData && mode === 'edit') {
        setName(initialData.name);
        const emojiOnly = initialData.icon.replace('emoji:', '');
        setIcon(emojiOnly);
        setIsValidEmoji(isEmoji(emojiOnly));
        setColor(initialData.color);
      } else {
        setName('');
        setIcon('');
        setIsValidEmoji(true);
        setColor('#000000');
      }
    }
  }, [visible, initialData, mode]);

  const handleIconChange = (text: string) => {
    setIcon(text);
    setIsValidEmoji(isEmoji(text));
  };

  const handleSave = async () => {
    if (!name || !icon || !isValidEmoji) return;
    await onSave({
      name,
      icon: `emoji:${icon}`,
      color,
    });
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-end bg-black/40"
        >
            <View 
              className="bg-white dark:bg-gray-900 rounded-t-[32px] max-h-[85%]"
              style={{ paddingBottom: Math.max(insets.bottom, 24) }}
            >
                {/* Header */}
                <View className="flex-row justify-between items-center px-6 pt-6 pb-4">
                    <Text className="text-xl font-bold text-center flex-1 ml-6">
                        {mode === 'add' ? 'New Category' : 'Edit Category'}
                    </Text>
                    <Pressable onPress={onClose} className="p-2 bg-gray-100 rounded-full dark:bg-gray-800">
                        <Icon name="xmark" size={16} color="gray" />
                    </Pressable>
                </View>

                <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
                    {/* Icon Input */}
                    <View className="items-center">
                        <View className={`w-24 h-24 bg-gray-50 dark:bg-gray-800 rounded-full items-center justify-center border-2 border-dashed mb-2 ${
                            !isValidEmoji ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'
                        }`}>
                             <TextInput
                                value={icon}
                                onChangeText={handleIconChange}
                                placeholderTextColor="#9CA3AF"
                                className="text-5xl text-center w-full text-black dark:text-white"
                                style={{ textAlign: 'center' }}
                                maxLength={2}
                                autoFocus={mode === 'add'}
                             />
                        </View>
                        {!isValidEmoji ? (
                            <Text className="text-red-500 text-xs font-medium mb-1">Harus emoji yang valid</Text>
                        ) : (
                            <Text className="text-gray-400 text-xs font-medium">Type an Emoji</Text>
                        )}
                    </View>

                    {/* Name Input */}
                    <View>
                        <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 ml-1">Category Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g., Food, Travel"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-4 text-lg font-medium font-sans text-black dark:text-white"
                        />
                    </View>

                    {/* Buttons */}
                    <View className="gap-3 mt-4">
                        <Pressable 
                            onPress={handleSave}
                            disabled={!name || !icon || !isValidEmoji}
                            className={`w-full py-4 rounded-full items-center justify-center ${
                                !name || !icon || !isValidEmoji ? 'bg-gray-200 dark:bg-gray-700' : 'bg-black dark:bg-white'
                            }`}
                        >
                            <Text className={`font-bold text-lg ${
                                !name || !icon || !isValidEmoji ? 'text-gray-400' : 'text-white dark:text-black'
                            }`}>
                                Save Category
                            </Text>
                        </Pressable>

                        {mode === 'edit' && onDelete && (
                            <Pressable 
                                onPress={() => {
                                    setAlertConfig({
                                        visible: true,
                                        title: 'Hapus Kategori',
                                        message: 'Kategori dan semua transaksi terkait akan dihapus. Yakin ingin melanjutkan?',
                                        buttons: [
                                            {
                                                text: 'Batal',
                                                style: 'cancel',
                                                onPress: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                                            },
                                            {
                                                text: 'Hapus',
                                                style: 'destructive',
                                                onPress: () => {
                                                    setAlertConfig(prev => ({ ...prev, visible: false }));
                                                    if (onDelete) {
                                                        onDelete();
                                                        onClose();
                                                    }
                                                }
                                            }
                                        ]
                                    });
                                }}
                                className="w-full py-4 rounded-full items-center justify-center bg-red-50 dark:bg-red-900/20"
                            >
                                <Text className="text-red-500 font-bold text-lg">Delete Category</Text>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>
            </View>

            <CustomAlertModal
              visible={alertConfig.visible}
              title={alertConfig.title}
              message={alertConfig.message}
              buttons={alertConfig.buttons}
              onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </KeyboardAvoidingView>
    </Modal>
  );
}
