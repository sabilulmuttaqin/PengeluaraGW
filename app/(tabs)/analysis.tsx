import { View, FlatList, Pressable, Alert, ScrollView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/nativewindui/Text';
import { useExpenseStore, Transaction } from '@/store';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Icon } from '@/components/nativewindui/Icon';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { CustomWheelPicker } from '@/components/CustomWheelPicker';
import { useColorScheme } from '@/lib/useColorScheme';
import { CustomAlertModal, AlertButton } from '@/components/CustomAlertModal';
import { useTranslation } from 'react-i18next';

const START_YEAR = 2020;
const YEARS = Array.from({ length: 30 }, (_, i) => (START_YEAR + i).toString());
const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

export default function AnalysisScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const { transactions, fetchRecentTransactions, deleteTransaction } = useExpenseStore();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'id' ? idLocale : enUS;
  const MONTHS = useMemo(() => [
    t('months.jan'), t('months.feb'), t('months.mar'), t('months.apr'),
    t('months.may'), t('months.jun'), t('months.jul'), t('months.aug'),
    t('months.sep'), t('months.oct'), t('months.nov'), t('months.dec')
  ], [t]);
  
  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState(new Date());

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{
      visible: boolean;
      title: string;
      message: string;
      buttons: AlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [] });

  useEffect(() => {
    fetchRecentTransactions(db);
  }, [db]);

  // Filter logic with date range
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const tDate = parseISO(t.date);
      return isWithinInterval(tDate, { 
        start: startOfDay(startDate), 
        end: endOfDay(endDate) 
      });
    });
  }, [startDate, endDate, transactions]);

  const totalFiltered = useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredData]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; icon: string }>();
    filteredData.forEach(t => {
      const name = t.category_name || 'Uncategorized';
      const icon = t.category_icon || '';
      const current = map.get(name) || { total: 0, icon };
      map.set(name, { total: current.total + t.amount, icon: current.icon || icon });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, total: data.total, icon: data.icon }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const handleDeleteTransaction = useCallback((id: number, note: string) => {
    setAlertConfig({
       visible: true,
       title: t('analysis.deleteTransaction'),
       message: `${t('analysis.deleteConfirm')} "${note}"?`,
       buttons: [
          { 
             text: t('common.cancel'), 
             style: "cancel", 
             onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) 
          },
          { 
            text: t('common.delete'), 
            style: "destructive", 
            onPress: async () => {
               setAlertConfig(prev => ({ ...prev, visible: false }));
               await deleteTransaction(db, id);
               fetchRecentTransactions(db);
            }
          }
       ]
    });
  }, [db, deleteTransaction, fetchRecentTransactions]);

  const renderTransaction = useCallback(({ item }: { item: Transaction }) => (
    <View 
      className="px-5 py-4 flex-row items-center gap-4 bg-white dark:bg-gray-900 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-800 mb-3 mx-5"
    >
      {/* Emoji Circle */}
      <View className="w-12 h-12 rounded-full items-center justify-center bg-gray-50 dark:bg-gray-800">
        {item.category_icon?.startsWith('emoji:') ? (
          <Text className="text-xl font-sans">{item.category_icon.replace('emoji:', '')}</Text>
        ) : (
          <Icon name="circle.fill" size={24} color="gray" />
        )}
      </View>

      {/* Transaction Info */}
      <View className="flex-1">
        <Text className="font-bold font-sans text-[17px] mb-0.5">{item.note || t('home.noNote')}</Text>
        <Text className="text-gray-500 font-sans text-[16px]">{item.category_name}</Text>
        <Text className="text-gray-400 font-sans text-[14px] mt-1">{format(parseISO(item.date), 'dd MMM yyyy', { locale: dateLocale })}</Text>
      </View>

      {/* Amount & Delete */}
      <View className="items-end gap-2">
        <Text className={`font-bold font-sans text-[18px] ${item.type === 'income' ? 'text-emerald-500' : ''}`}>
          {item.type === 'income' ? '+' : '-'}Rp {item.amount.toLocaleString('id-ID')}
        </Text>
        
        {/* Delete Button */}
        <Pressable 
          onPress={() => handleDeleteTransaction(item.id, item.note || t('home.noNote'))}
          className="p-1"
        >
          <Icon name="trash" size={18} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  ), [handleDeleteTransaction, t, dateLocale]);

  const ListHeader = useMemo(() => (
    <View className="px-5 pt-5 pb-2">
      {/* Total */}


      {/* Breakdown Cards */}
      <View className="mb-6">
        <Text variant="title3" className="font-bold font-sans mb-4">{t('analysis.breakdown')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-5 px-5" contentContainerStyle={{ paddingRight: 20 }}>
          {categoryBreakdown.map((item) => (
            <View key={item.name} className="mr-3">
              {/* Main Category Card */}
              <View 
                className="w-28 h-32 p-3 rounded-t-[24px] flex-col items-center justify-between bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 border-b-0 shadow-sm"
              >
                {/* Emoji - smaller */}
                <View className="flex-1 items-center justify-center">
                  {item.icon?.startsWith('emoji:') ? (
                    <Text className="text-3xl">{item.icon.replace('emoji:', '')}</Text>
                  ) : (
                    <Icon name="circle.fill" size={28} color="gray" />
                  )}
                </View>
                
                {/* Info */}
                <View className="w-full items-center">
                  <Text className="text-gray-500 dark:text-gray-400 text-sm font-sans mb-0.5" numberOfLines={1}>{item.name}</Text>
                  <Text className="text-gray-900 dark:text-white text-base font-bold font-sans">Rp {(item.total / 1000).toFixed(0)}k</Text>
                </View>
              </View>
              
              {/* Percentage Card - attached below */}
              <View className="w-28 py-2 rounded-b-[24px] bg-black dark:bg-white items-center justify-center">
                <Text className="text-white dark:text-black font-bold text-sm font-sans">{((item.total / (totalFiltered || 1)) * 100).toFixed(0)}%</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {categoryBreakdown.length === 0 && (
          <Text className="text-gray-400 text-center py-10">{t('analysis.noExpenses')}</Text>
        )}
      </View>

      {/* All Transactions Header */}
      <Text variant="title3" className="font-bold font-sans mb-4">{t('analysis.allTransactions')}</Text>
    </View>
  ), [categoryBreakdown, totalFiltered, filteredData.length, t]);
  
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header with Date Range */}
      <View className="px-4 py-4 border-b dark:border-gray-800 border-gray-200 bg-background z-10">
        <Text className="text-2xl font-bold font-sans mb-4">{t('analysis.title')}</Text>
        
        {/* Date Range Picker - Pill Style */}
        <View className="flex-row items-center justify-center gap-3">
          <Pressable 
            onPress={() => {
              setTempDate(startDate);
              setActivePicker('start');
            }}
            className="flex-row items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <Icon name="calendar" size={16} color={colorScheme === 'dark' ? 'white' : 'black'} />
            <Text className="ml-2 font-medium font-sans">{format(startDate, 'dd MMM yyyy', { locale: dateLocale })}</Text>
          </Pressable>

          <Text className="text-gray-400">—</Text>

          <Pressable 
            onPress={() => {
              setTempDate(endDate);
              setActivePicker('end');
            }}
            className="flex-row items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <Icon name="calendar" size={16} color={colorScheme === 'dark' ? 'white' : 'black'} />
            <Text className="ml-2 font-medium font-sans">{format(endDate, 'dd MMM yyyy', { locale: dateLocale })}</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTransaction}
        ListHeaderComponent={() => ListHeader}
        ListEmptyComponent={() => (
          <View className="px-5">
            <Text className="text-gray-400 text-center py-10">{t('analysis.noTransactions')}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Custom Date Picker Modal */}
      <Modal
        transparent={true}
        visible={activePicker !== null}
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-white dark:bg-gray-900 w-full rounded-[32px] p-6 shadow-xl border border-gray-100 dark:border-gray-800">
            <Text className="text-xl font-bold font-sans text-center mb-6 text-black dark:text-white">
                {activePicker === 'start' ? t('analysis.startDate') : t('analysis.endDate')}
            </Text>
            
            {/* Context Headers */}
            <View className="flex-row w-full mb-2 justify-center gap-2">
              <Text className="w-[60px] text-center font-medium text-xs font-sans text-gray-500 tracking-widest">TGL</Text>
              <Text className="w-[100px] text-center font-medium text-xs font-sans text-gray-500 tracking-widest">BULAN</Text>
              <Text className="w-[80px] text-center font-medium text-xs font-sans text-gray-500 tracking-widest">TAHUN</Text>
            </View>

            {activePicker !== null && (
                <View className="flex-row justify-center items-center h-[180px] gap-2">
                    {/* Day */}
                    <CustomWheelPicker 
                        key={`day-${tempDate.getMonth()}-${tempDate.getFullYear()}`}
                        data={Array.from({ length: getDaysInMonth(tempDate.getMonth(), tempDate.getFullYear()) }, (_, i) => (i + 1).toString())}
                        selectedIndex={tempDate.getDate() - 1}
                        onValueChange={(i) => {
                            const d = new Date(tempDate);
                            d.setDate(i + 1);
                            setTempDate(d);
                        }}
                        width={60}
                    />
                    {/* Month */}
                    <CustomWheelPicker 
                        data={MONTHS}
                        selectedIndex={tempDate.getMonth()}
                        onValueChange={(i) => {
                            const d = new Date(tempDate);
                            const newMonth = i;
                            const maxDays = getDaysInMonth(newMonth, d.getFullYear());
                            const currentDay = d.getDate();
                            d.setDate(1); 
                            d.setMonth(newMonth);
                            d.setDate(Math.min(currentDay, maxDays));
                            setTempDate(d);
                        }}
                        width={100}
                    />
                    {/* Year */}
                    <CustomWheelPicker 
                        data={YEARS}
                        selectedIndex={tempDate.getFullYear() - START_YEAR}
                        onValueChange={(i) => {
                           const d = new Date(tempDate);
                           const newYear = START_YEAR + i;
                           const currentMonth = d.getMonth();
                           const maxDays = getDaysInMonth(currentMonth, newYear);
                           const currentDay = d.getDate();
                           d.setDate(1);
                           d.setFullYear(newYear);
                           d.setDate(Math.min(currentDay, maxDays));
                           setTempDate(d);
                        }}
                        width={80}
                    />
                </View>
            )}

            <View className="flex-row gap-3 mt-6">
              <Pressable 
                 onPress={() => setActivePicker(null)}
                 className="flex-1 py-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 items-center justify-center"
              >
                 <Text className="font-bold font-sans text-gray-900 dark:text-white">Batal</Text>
              </Pressable>
              <Pressable 
                 onPress={() => {
                    if (activePicker === 'start') setStartDate(tempDate);
                    if (activePicker === 'end') setEndDate(tempDate);
                    setActivePicker(null);
                 }}
                 className="flex-1 py-3.5 rounded-2xl bg-black dark:bg-white items-center justify-center"
              >
                 <Text className="font-bold font-sans text-white dark:text-black">Pilih</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {/* Custom Alert Modal */}
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
