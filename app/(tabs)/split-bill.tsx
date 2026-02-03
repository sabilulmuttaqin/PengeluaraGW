import { View, FlatList, Pressable, Platform, Alert, Modal, ScrollView } from 'react-native';
import { Text } from '@/components/nativewindui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExpenseStore, SplitBill, SplitBillMember } from '@/store';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/nativewindui/Icon';
import { SplitBillModal } from '@/components/SplitBillModal';
import { format } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { useColorScheme } from '@/lib/useColorScheme';
import { useTranslation } from 'react-i18next';

export default function SplitBillScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { splitBills, fetchSplitBills, deleteSplitBill } = useExpenseStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedBill, setSelectedBill] = useState<SplitBill | null>(null);
  const [members, setMembers] = useState<SplitBillMember[]>([]);
  const { colorScheme } = useColorScheme();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'id' ? idLocale : enUS;

  useEffect(() => {
    fetchSplitBills(db);
  }, []);

  const handleDelete = (id: number) => {
    Alert.alert(
      t('common.delete'),
      t('splitBill.deleteConfirm'),
      [
        { text: t('common.cancel'), style: "cancel" },
        { text: t('common.delete'), style: "destructive", onPress: () => deleteSplitBill(db, id) }
      ]
    );
  };

  const openDetail = async (bill: SplitBill) => {
    setSelectedBill(bill);
    try {
      const result = await db.getAllAsync<SplitBillMember>(
        'SELECT * FROM split_bill_members WHERE split_bill_id = ?',
        [bill.id]
      );
      setMembers(result);
      setDetailVisible(true);
    } catch (e) {
      console.error('Error fetching members:', e);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header - Standardized */}
      <View className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-background z-10">
        <Text className="text-2xl font-bold font-sans mb-4">{t('splitBill.title')}</Text>
      </View>

      {/* List */}
      <FlatList
        data={splitBills}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
            <View className="items-center justify-center py-20">
                <Icon name="scroll" size={48} color="gray" />
                <Text className="text-gray-400 mt-4 text-center font-sans">{t('splitBill.noHistory')}</Text>
            </View>
        }
        renderItem={({ item }) => (
            <Pressable 
              onPress={() => openDetail(item)}
              className="bg-white dark:bg-gray-900 p-4 rounded-xl mb-3 shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98]"
            >
                <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                        <Text className="font-semibold text-lg font-sans">{item.name}</Text>
                        <Text className="text-gray-500 text-xs font-sans">{format(new Date(item.date), 'dd MMMM yyyy', { locale: dateLocale })}</Text>
                    </View>
                    <Pressable onPress={() => handleDelete(item.id)} hitSlop={10}>
                        <Icon name="trash" size={18} color="#ef4444" />
                    </Pressable>
                </View>
                <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Text className="text-gray-500 text-sm font-sans">{t('splitBill.totalBill')}</Text>
                    <Text className="font-bold text-lg font-sans text-primary">Rp {item.total_amount.toLocaleString('id-ID')}</Text>
                </View>
            </Pressable>
        )}
      />

      {/* FAB */}
      <View className="absolute bottom-6 right-4" pointerEvents="box-none">
          <Pressable 
              onPress={() => setModalVisible(true)}
              className="w-14 h-14 rounded-full bg-black dark:bg-white items-center justify-center active:scale-95 shadow-lg"
          >
              <Icon name="plus" size={24} color={colorScheme === 'dark' ? 'black' : 'white'} />
          </Pressable>
      </View>

      <SplitBillModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />

      {/* Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" transparent={true} onRequestClose={() => setDetailVisible(false)}>
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/50" onPress={() => setDetailVisible(false)} />
          <View className="bg-background w-full rounded-t-[32px] overflow-hidden max-h-[70%]">
            {/* Header */}
            <View className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-row justify-between items-center">
              <Text className="font-bold text-lg font-sans">{t('splitBill.detail')}</Text>
              <Pressable onPress={() => setDetailVisible(false)} hitSlop={10}>
                <Icon name="xmark.circle.fill" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4">
              {selectedBill && (
                <>
                  {/* Bill Info */}
                  <View className="mb-6">
                    <Text className="text-2xl font-bold font-sans">{selectedBill.name}</Text>
                    <Text className="text-gray-500 mt-1 font-sans">{format(new Date(selectedBill.date), 'dd MMMM yyyy', { locale: dateLocale })}</Text>
                    <View className="flex-row items-center mt-3 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl">
                      <Text className="text-gray-500 flex-1 font-sans">{t('splitBill.totalBill')}</Text>
                      <Text className="font-bold text-xl font-sans">Rp {selectedBill.total_amount.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>

                  {/* Members */}
                  <Text className="font-bold text-base mb-3 font-sans">{t('splitBill.division')} ({members.length})</Text>
                  {members.map(member => (
                    <View 
                      key={member.id} 
                      className="flex-row justify-between items-center p-3 bg-white dark:bg-gray-900 rounded-xl mb-2 border border-gray-100 dark:border-gray-800"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className={`w-10 h-10 rounded-full items-center justify-center ${member.is_me ? 'bg-black dark:bg-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                          <Text className={`font-bold font-sans ${member.is_me ? 'text-white dark:text-black' : 'text-black dark:text-white'}`}>
                            {member.name[0]}
                          </Text>
                        </View>
                        <View>
                          <Text className="font-medium font-sans">{member.name}</Text>
                          {member.is_me && <Text className="text-xs text-gray-500 font-sans">{t('splitBill.me')}</Text>}
                        </View>
                      </View>
                      <Text className="font-bold font-sans">Rp {Math.ceil(member.share_amount).toLocaleString('id-ID')}</Text>
                    </View>
                  ))}

                  <View className="h-8" />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
