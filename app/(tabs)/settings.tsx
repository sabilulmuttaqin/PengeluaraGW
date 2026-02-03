import { View, ScrollView, Switch, Pressable, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/nativewindui/Text';
import { Icon } from '@/components/nativewindui/Icon';
import { ThemeToggle } from '@/components/nativewindui/ThemeToggle';
import { useColorScheme } from '@/lib/useColorScheme';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestPermissions, scheduleMultipleReminders, ReminderTime, cancelAllReminders } from '@/utils/notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useExpenseStore } from '@/store';
import { CustomWheelPicker } from '@/components/CustomWheelPicker';
import { CustomAlertModal, AlertButton } from '@/components/CustomAlertModal';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const REMINDER_STORAGE_KEY = 'reminderTimes';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { fetchRecentTransactions, fetchCategories } = useExpenseStore();
  const { t, i18n } = useTranslation();
  
  const [reminderTimes, setReminderTimes] = useState<ReminderTime[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date()); // Untuk state sementara di modal
  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  // Alert Config
  const [alertConfig, setAlertConfig] = useState<{
      visible: boolean;
      title: string;
      message: string;
      buttons?: AlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [] });

  const toggleLanguage = async () => {
    const newLang = currentLang === 'id' ? 'en' : 'id';
    await changeLanguage(newLang);
    setCurrentLang(newLang);
  };

  useEffect(() => {
    loadReminderTimes();
  }, []);

  const loadReminderTimes = async () => {
    try {
      const stored = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
      if (stored) {
        setReminderTimes(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading reminder times:', e);
    }
  };

  const saveReminderTimes = async (times: ReminderTime[]) => {
    try {
      await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(times));
      setReminderTimes(times);
      
      // Check if any are enabled
      const hasEnabled = times.some(t => t.enabled);
      if (hasEnabled) {
        const hasPermission = await requestPermissions();
        if (hasPermission) {
          await scheduleMultipleReminders(times);
        }
      } else {
        await cancelAllReminders();
      }
    } catch (e) {
      console.error('Error saving reminder times:', e);
    }
  };

  const addReminderTime = () => {
    const now = new Date();
    setSelectedTime(now);
    setTempTime(now); // Init temp time
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, date?: Date) => {
    if (date) {
      setTempTime(date);
    }
  };

  const saveNewReminder = () => {
    setShowTimePicker(false);
    const newReminder: ReminderTime = {
      id: `reminder-${Date.now()}`,
      hour: tempTime.getHours(),
      minute: tempTime.getMinutes(),
      enabled: true,
    };
    saveReminderTimes([...reminderTimes, newReminder]);
  };

  const toggleReminder = (id: string) => {
    const updated = reminderTimes.map(r => 
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    saveReminderTimes(updated);
  };

  const deleteReminder = (id: string) => {
    const updated = reminderTimes.filter(r => r.id !== id);
    saveReminderTimes(updated);
  };

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const exportDb = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        setAlertConfig({ visible: true, title: 'Error', message: 'Sharing is not available on this device' });
        return;
      }

      const dbDir = FileSystem.documentDirectory + 'SQLite';
      const dbPath = dbDir + '/myuang_clean.db'; // ✅ FIXED: Ganti dari myuang.db
      
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      
      if (!fileInfo.exists) {
        setAlertConfig({ visible: true, title: 'Error', message: 'Database file not found' });
        return;
      }

      await Sharing.shareAsync(dbPath, {
        dialogTitle: 'Backup MyUang Database',
        UTI: 'public.database',
        mimeType: 'application/x-sqlite3',
      });

    } catch (error) {
      console.error('Export error:', error);
      setAlertConfig({ visible: true, title: 'Error', message: 'Failed to export database' });
    }
  };

  const importDb = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const pickedFile = result.assets[0];
      
      // Confirm overwrite
      setAlertConfig({
        visible: true,
        title: 'Import Database',
        message: 'Ini akan MENGGANTI SEMUA data yang ada dengan data dari file backup. Lanjutkan?',
        buttons: [
          { text: 'Batal', style: 'cancel', onPress: () => setAlertConfig(prev => ({...prev, visible: false})) },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              setAlertConfig(prev => ({...prev, visible: false})); // Close confirm modal
              try {
                setLoading(true);
                
                const dbDir = FileSystem.documentDirectory + 'SQLite';
                const dbPath = dbDir + '/myuang_clean.db';

                // Copy the picked file to database location
                await FileSystem.copyAsync({
                  from: pickedFile.uri,
                  to: dbPath,
                });

                // ✅ FIXED: Hapus fetchCategories & fetchRecentTransactions
                // Karena database connection masih pakai yang lama
                // Data baru baru akan muncul setelah restart app

                // ✅ FIXED: Tambah instruksi restart app
                setAlertConfig({
                  visible: true,
                  title: 'Sukses',
                  message: 'Database berhasil diimport!\n\nSilakan TUTUP dan BUKA KEMBALI aplikasi untuk melihat data yang baru.',
                  buttons: [{ text: 'OK', onPress: () => setAlertConfig(prev => ({...prev, visible: false})) }]
                });

              } catch (err) {
                console.error('Import error:', err);
                setAlertConfig({ visible: true, title: 'Error', message: 'Gagal import database' });
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      });
    } catch (error) {
      console.error('Document picker error:', error);
      setAlertConfig({ visible: true, title: 'Error', message: 'Failed to pick file' });
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-background z-10">
          <Text className="text-2xl font-bold font-sans mb-4">{t('settings.title')}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}>
      {/* Appearance Section */}
      <View className="mb-8">
        <Text variant="title3" className="font-semibold mb-4 ml-2">{t('settings.preferences')}</Text>
        
        {/* Dark Mode */}
        <View className="bg-white dark:bg-gray-900 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-800 p-4 flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center">
                    <Icon name={colorScheme === 'dark' ? 'moon.fill' : 'sun.max.fill'} size={24} color={colorScheme === 'dark' ? 'white' : 'black'} />
                </View>
                <Text className="font-medium font-sans text-lg pt-1">{t('settings.darkMode')}</Text>
            </View>
            <ThemeToggle />
        </View>

        {/* Language Toggle */}
        <Pressable 
          onPress={toggleLanguage}
          className="bg-white dark:bg-gray-900 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-800 p-4 flex-row items-center justify-between active:scale-[0.98]"
        >
            <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center">
                    <Text className="text-2xl">{currentLang === 'id' ? '🇮🇩' : '🇬🇧'}</Text>
                </View>
                <Text className="font-medium font-sans text-lg pt-1">{t('settings.language')}</Text>
            </View>
            <View className="flex-row items-center gap-2">
                <Text className="text-gray-500 font-medium">{currentLang === 'id' ? 'Indonesia' : 'English'}</Text>
                <Icon name="chevron.right" size={14} color="gray" />
            </View>
        </Pressable>
      </View>

      {/* Notifications Section */}
      <View className="mb-8">
        <View className="flex-row justify-between items-center mb-4 ml-2">
          <Text variant="title3" className="font-semibold">{t('settings.reminders')}</Text>
          <Pressable 
            onPress={addReminderTime} 
            className="bg-black dark:bg-white px-4 py-2 rounded-full"
          >
            <Text className="font-medium text-sm text-white dark:text-black">{t('common.add')}</Text>
          </Pressable>
        </View>
        
        <View className="bg-white dark:bg-gray-900 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {reminderTimes.length === 0 ? (
            <View className="p-4 items-center">
              <Text className="text-gray-400 text-sm font-sans">{t('settings.noReminder')}</Text>
            </View>
          ) : (
            reminderTimes.map((reminder, index) => (
              <View 
                key={reminder.id} 
                className={`p-4 flex-row items-center justify-between ${
                  index < reminderTimes.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center">
                    <Icon name="bell.fill" size={18} color={reminder.enabled ? (colorScheme === 'dark' ? 'white' : 'black') : '#9CA3AF'} />
                  </View>
                  <Text className={`text-xl font-bold font-sans ${reminder.enabled ? '' : 'text-gray-400'}`}>
                    {formatTime(reminder.hour, reminder.minute)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <Pressable onPress={() => deleteReminder(reminder.id)} hitSlop={10}>
                    <Icon name="trash" size={18} color="#EF4444" />
                  </Pressable>
                  <Switch
                    value={reminder.enabled}
                    onValueChange={() => toggleReminder(reminder.id)}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Data Section */}
      <View className="mb-8">
        <Text variant="title3" className="font-semibold mb-4 ml-2">{t('settings.data')}</Text>
        
        {/* Export */}
        <Pressable 
          onPress={exportDb}
          className="bg-white dark:bg-gray-900 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-800 p-4 flex-row items-center justify-between mb-3"
        >
            <View className="flex-1 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center">
                    <Icon name="square.and.arrow.up" size={20} color={colorScheme === 'dark' ? 'white' : 'black'} />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-lg">{t('settings.exportDb')}</Text>
                  <Text className="text-gray-500 text-xs">{t('settings.exportDbDesc')}</Text>
                </View>
            </View>
            <Icon name="chevron.right" size={16} color="gray" />
        </Pressable>

        {/* Import */}
        <Pressable 
          onPress={importDb}
          disabled={loading}
          className="bg-white dark:bg-gray-900 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-800 p-4 flex-row items-center justify-between"
        >
            <View className="flex-1 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center">
                    <Icon name="square.and.arrow.down" size={20} color={colorScheme === 'dark' ? 'white' : 'black'} />
                </View>
                <View className="flex-1">
                  <Text className="font-medium text-lg">{t('settings.importDb')}</Text>
                  <Text className="text-gray-500 text-xs">{t('settings.importDbDesc')}</Text>
                </View>
            </View>
            <Icon name="chevron.right" size={16} color="gray" />
        </Pressable>
      </View>

      <View className="items-center mt-auto mb-10">
        <Text className="text-gray-400 text-sm">MyUang v2.0.0</Text>
      </View>
    </ScrollView>

    {/* Custom Time Picker Modal */}
    <Modal
      transparent={true}
      visible={showTimePicker}
      animationType="fade"
      onRequestClose={() => setShowTimePicker(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50 px-6">
        <View className="bg-white dark:bg-gray-900 w-full rounded-[32px] p-6 shadow-xl border border-gray-100 dark:border-gray-800">
          <Text className="text-xl font-bold font-sans text-center mb-6 text-black dark:text-white">{t('settings.selectTime')}</Text>
          
          {/* Context Headers */}
          <View className="flex-row w-full mb-2 justify-center gap-2">
            <Text className="w-[80px] text-center font-medium text-xs font-sans text-gray-500 tracking-widest">{t('settings.hour')}</Text>
            <Text className="w-[20px]"></Text>
            <Text className="w-[80px] text-center font-medium text-xs font-sans text-gray-500 tracking-widest">{t('settings.minute')}</Text>
          </View>

          {showTimePicker && (
            <View className="flex-row justify-center items-center h-[180px] gap-2">
               <CustomWheelPicker 
                  data={HOURS}
                  selectedIndex={tempTime.getHours()}
                  onValueChange={(i) => {
                      const d = new Date(tempTime);
                      d.setHours(i);
                      setTempTime(d);
                  }}
                  width={80}
               />
               <Text className="text-2xl font-bold font-sans text-black dark:text-white pb-2">:</Text>
               <CustomWheelPicker 
                  data={MINUTES}
                  selectedIndex={tempTime.getMinutes()}
                  onValueChange={(i) => {
                      const d = new Date(tempTime);
                      d.setMinutes(i);
                      setTempTime(d);
                  }}
                  width={80}
               />
            </View>
          )}

          <View className="flex-row gap-3 mt-6">
            <Pressable 
               onPress={() => setShowTimePicker(false)}
               className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 items-center justify-center"
            >
               <Text className="font-bold font-sans text-gray-900 dark:text-white">{t('common.cancel')}</Text>
            </Pressable>
            <Pressable 
               onPress={saveNewReminder}
               className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white items-center justify-center"
            >
               <Text className="font-bold font-sans text-white dark:text-black">{t('common.save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    
    <CustomAlertModal
      visible={alertConfig.visible}
      title={alertConfig.title}
      message={alertConfig.message}
      buttons={alertConfig.buttons}
      onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
    />
    </View>
  );
}