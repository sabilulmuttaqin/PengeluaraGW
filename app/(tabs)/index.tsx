import { View, Pressable, RefreshControl, ScrollView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useCallback, useState, useMemo } from 'react';
import { useExpenseStore, Category, Transaction } from '@/store';
import { Text } from '@/components/nativewindui/Text';
import { Link, Stack, router } from 'expo-router';
import { Icon } from '@/components/nativewindui/Icon';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { CategoryFormModal } from '@/components/CategoryFormModal';
import { useColorScheme } from '@/lib/useColorScheme';
import { SmartTextModal } from '@/components/SmartTextModal';
import { OCRModal } from '@/components/OCRModal';
import { ActionMenuModal } from '@/components/ActionMenuModal';
import { useTranslation } from 'react-i18next';
// import { VoiceModal } from '@/components/VoiceModal';

export default function Dashboard() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  
  const { 
    transactions, 
    totalMonth, // now balance
    totalIncome,
    totalExpense,
    categories,
    fetchRecentTransactions, 
    calculateTotalMonth,

    fetchCategories,
    addCategory,
    updateCategory
  } = useExpenseStore();
  
  const { colorScheme } = useColorScheme();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'id' ? idLocale : enUS;
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isAmountVisible, setIsAmountVisible] = useState(true);
  
  // FAB Modals
  const [menuVisible, setMenuVisible] = useState(false);
  const [ocrVisible, setOCRVisible] = useState(false);
  const [smartTextVisible, setSmartTextVisible] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);

  const loadData = useCallback(async () => {
    // Categories must be fetched first to be available for calculation
    await fetchCategories(db); 
    await Promise.all([
        fetchRecentTransactions(db),
        calculateTotalMonth(db, selectedMonth)
    ]);
  }, [db, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCategoryModal = (mode: 'add' | 'edit', category?: Category) => {
      setModalMode(mode);
      setSelectedCategory(category || null);
      setCategoryModalVisible(true);
  };

  const handleSaveCategory = async (data: { name: string; icon: string; color: string }) => {
      if (modalMode === 'add') {
          await addCategory(db, { ...data, budget_limit: 0 });
      } else if (modalMode === 'edit' && selectedCategory) {
          await updateCategory(db, selectedCategory.id, data);
      }
      await fetchCategories(db);
  };
  
  const handleDeleteCategory = async (id: number) => {
      const { deleteCategory } = useExpenseStore.getState();
      await deleteCategory(db, id);
      setCategoryModalVisible(false);
  };

  const handleFabPress = () => {
    setMenuVisible(true);
  };

  const handleMenuSelect = (id: string) => {
       switch(id) {
           case 'manual': router.push('/add-transaction'); break;
           case 'ocr': setOCRVisible(true); break;
           case 'smart': setSmartTextVisible(true); break;
           case 'voice': setVoiceVisible(true); break;
       }
  };


  // Filter transactions by selected month
  const filteredTransactions = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    return transactions.filter(t => {
      const tDate = parseISO(t.date);
      return isWithinInterval(tDate, { start: monthStart, end: monthEnd });
    });
  }, [transactions, selectedMonth]);


  const ListHeader = useMemo(() => (
    <View className="px-5 pt-8 pb-6 bg-background">
        {/* Top Header: Month Selector */}
      <View className="flex-row justify-center items-center mb-6 px-1 relative">
            <View className="flex-row items-center gap-3">
                <Pressable hitSlop={10} onPress={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                    <Icon name="chevron.left" size={24} color={colorScheme === 'dark' ? 'white' : 'black'} />
                </Pressable>
                <Text className="text-2xl font-bold font-sans">{format(selectedMonth, 'MMMM yyyy', { locale: dateLocale })}</Text>
                <Pressable hitSlop={10} onPress={() => setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                    <Icon name="chevron.right" size={24} color={colorScheme === 'dark' ? 'white' : 'black'} />
                </Pressable>
            </View>
      </View>

      {/* Hero Section: Balance Card */}
      <View className="bg-black dark:bg-gray-900 rounded-[32px] p-6 items-center relative overflow-hidden shadow-sm h-48 justify-center mb-4 border border-gray-800 dark:border-gray-800">
            
            <Text className="text-gray-400 font-medium font-sans mb-1 text-xs uppercase tracking-widest">{t('home.balance')}</Text>
            
            <View className="flex-row items-center gap-2 mb-1">
                <Text className={`text-4xl font-bold font-sans tracking-tighter ${totalMonth >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {isAmountVisible ? `IDR ${Math.abs(totalMonth).toLocaleString('id-ID')}` : 'IDR ***'}
                </Text>
                <Pressable onPress={() => setIsAmountVisible(!isAmountVisible)}>
                     <Icon name={isAmountVisible ? "eye.fill" : "eye.slash.fill"} size={18} color="#9CA3AF" />
                </Pressable>
            </View>

            <Text className="text-gray-400 text-sm font-sans mt-2">
                {isAmountVisible ? `${filteredTransactions.length} ${t('home.transactions')}` : `*** ${t('home.transactions')}`}
            </Text>
      </View>

      {/* Income & Expense Cards */}
      <View className="flex-row gap-3 mb-4">
        {/* Income Card */}
        <View className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-[24px] p-4 border border-emerald-100 dark:border-emerald-800">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center">
              <Icon name="arrow.down" size={14} color="#10B981" />
            </View>
            <Text className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">{t('home.income')}</Text>
          </View>
          <Text className="text-emerald-700 dark:text-emerald-300 font-bold text-lg">
            {isAmountVisible ? `+Rp ${totalIncome.toLocaleString('id-ID')}` : '+Rp ***'}
          </Text>
        </View>

        {/* Expense Card */}
        <View className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-[24px] p-4 border border-red-100 dark:border-red-800">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="w-8 h-8 rounded-full bg-red-500/20 items-center justify-center">
              <Icon name="arrow.up" size={14} color="#EF4444" />
            </View>
            <Text className="text-red-600 dark:text-red-400 font-medium text-sm">{t('home.expense')}</Text>
          </View>
          <Text className="text-red-700 dark:text-red-300 font-bold text-lg">
            {isAmountVisible ? `-Rp ${totalExpense.toLocaleString('id-ID')}` : '-Rp ***'}
          </Text>
        </View>
      </View>


      {/* Categories Horizontal Scroll */}
      <View>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-4 -mx-4 px-4 py-2" contentContainerStyle={{ paddingRight: 20 }}>
             {/* Add Card */}
             <Pressable 
                onPress={() => openCategoryModal('add')}
                className="w-20 h-28 items-center justify-center rounded-[24px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm active:scale-95 transition-transform"
             >
                 <View className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center mb-1">
                    <Icon name="plus" size={20} color={colorScheme === 'dark' ? 'white' : 'black'} />
                 </View>
                 <Text className="text-sm font-medium font-sans text-gray-400">{t('common.add')}</Text>
             </Pressable>

             {/* Dynamic Category Cards */}
             {categories.map(cat => (
                 <Pressable 
                    key={cat.id} 
                    onPress={() => openCategoryModal('edit', cat)}
                    className="w-24 h-28 p-3 rounded-[24px] flex-col items-center justify-between bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm ml-3 active:scale-95 transition-transform"
                 >
                     {/* Emoji centered and larger */}
                     <View className="flex-1 items-center justify-center">
                         {cat.icon.startsWith('emoji:') ? (
                             <Text className="text-4xl">{cat.icon.replace('emoji:', '')}</Text>
                         ) : (
                            <Icon name="circle.fill" size={32} color={colorScheme === 'dark' ? 'white' : 'black'} />
                         )}
                     </View>
                     
                     {/* Text at bottom centered */}
                     <View className="w-full items-center">
                         <Text className="text-gray-900 dark:text-white font-semibold text-sm mb-0.5" numberOfLines={1}>{cat.name}</Text>
                         <Text className="text-gray-900 dark:text-white text-sm font-bold">
                             {cat.totalSpent ? `Rp ${(cat.totalSpent / 1000).toFixed(0)}k` : 'Rp 0'}
                         </Text>
                     </View>
                 </Pressable>
             ))}
         </ScrollView>
      </View>

            <Text className="font-bold text-xl mt-2 text-gray-900 dark:text-gray-100">{t('home.lastTransactions')}</Text>
    </View>
  ), [selectedMonth, totalMonth, isAmountVisible, categories, colorScheme, filteredTransactions, t, dateLocale, totalIncome, totalExpense]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-gray-50 dark:bg-black" style={{ paddingTop: insets.top }}>
        <FlatList
          data={filteredTransactions.slice(0, 10)} 
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={() => ListHeader}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={loadData} />
          }
          ListEmptyComponent={() => (
             <View className="items-center py-10">
                <Text className="text-gray-400 font-medium font-sans">{t('home.noTransactions')}</Text>
             </View>
          )}
          renderItem={({ item }: { item: Transaction }) => (
            <View className="px-5 py-4 flex-row items-center gap-4 bg-white dark:bg-gray-900 mx-5 mb-3 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-800">
              <View 
                className="w-12 h-12 rounded-full items-center justify-center bg-gray-50 dark:bg-gray-800"
              >
                  {item.category_icon?.startsWith('emoji:') ? (
                      <Text className="text-xl font-sans">{item.category_icon.replace('emoji:', '')}</Text>
                  ) : (
                     <Icon name="circle.fill" size={24} color="gray" />
                  )}
              </View>

              <View className="flex-1">
                  <Text className="font-bold font-sans text-[17px] mb-0.5">{item.note || t('home.noNote')}</Text>
                  <Text className="text-gray-500 font-sans text-[16px]">{item.category_name}</Text>
                  <Text className="text-gray-400 font-sans text-[14px] mt-1">{format(parseISO(item.date), 'dd MMM yyyy', { locale: dateLocale })}</Text>
              </View>

              <View className="items-end">
                  <Text className={`font-bold font-sans text-[18px] ${item.type === 'income' ? 'text-emerald-500' : ''}`}>
                    {item.type === 'income' ? '+' : '-'}Rp {item.amount.toLocaleString('id-ID')}
                  </Text>
              </View>
            </View>
          )}
        />
        
        {/* Floating Action Button */}
        <View className="absolute right-4 bottom-6" pointerEvents="box-none">
            <Pressable 
                onPress={handleFabPress}
                className="w-14 h-14 rounded-full bg-black dark:bg-white items-center justify-center active:scale-95 shadow-lg"
            >
                <Icon name="plus" size={24} color={colorScheme === 'dark' ? 'black' : 'white'} />
            </Pressable>
        </View>
      </View>

      <CategoryFormModal 
        visible={isCategoryModalVisible}
        mode={modalMode}
        initialData={selectedCategory ? {
          name: selectedCategory.name,
          icon: selectedCategory.icon,
          color: selectedCategory.color
        } : undefined}
        onClose={() => setCategoryModalVisible(false)}
        onSave={handleSaveCategory}
        onDelete={selectedCategory ? () => handleDeleteCategory(selectedCategory.id) : undefined}
      />
      
      <SmartTextModal 
        visible={smartTextVisible}
        onClose={() => setSmartTextVisible(false)}
      />

      <OCRModal 
        visible={ocrVisible}
        onClose={() => setOCRVisible(false)}
      />

      {/* <VoiceModal 
        visible={voiceVisible}
        onClose={() => setVoiceVisible(false)}
      /> */}

      <ActionMenuModal 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)}
        onSelect={handleMenuSelect}
      />
    </>
  );
}
