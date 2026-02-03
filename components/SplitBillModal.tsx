import { View, Modal, ActivityIndicator, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { Text } from '@/components/nativewindui/Text';
import { Icon } from '@/components/nativewindui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { parseExpenseImage, ParsedExpense } from '@/utils/gemini';
import { useExpenseStore } from '@/store';
import { useSQLiteContext } from 'expo-sqlite';
import { useColorScheme } from '@/lib/useColorScheme';

interface SplitBillModalProps {
  visible: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'review' | 'members' | 'assign' | 'summary';

interface BillItem extends ParsedExpense {
  id: string;
  assignedTo: string[];
}

interface Friend {
  id: string;
  name: string;
  isMe: boolean;
}

export function SplitBillModal({ visible, onClose }: SplitBillModalProps) {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { categories, addSplitBill, addExpense } = useExpenseStore();
  const { colorScheme } = useColorScheme();
  
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  
  const [billName, setBillName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [friends, setFriends] = useState<Friend[]>([{ id: 'me', name: 'Saya', isMe: true }]);
  const [newFriendName, setNewFriendName] = useState('');
  
  const reset = () => {
    setStep('upload');
    setBillName('');
    setImageUri(null);
    setImageBase64(null);
    setItems([]);
    setFriends([{ id: 'me', name: 'Saya', isMe: true }]);
    setNewFriendName('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (!result.canceled) {
      processImage(result.assets[0].uri, result.assets[0].base64);
    }
  };
  
  const takePhoto = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
          Alert.alert('Permission denied', 'Camera permission is required.');
          return;
      }
      const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 1,
          base64: true,
      });

      if (!result.canceled) {
          processImage(result.assets[0].uri, result.assets[0].base64);
      }
  };

  const processImage = async (uri: string, base64?: string | null) => {
    setImageUri(uri);
    setImageBase64(base64 || null);
    setLoading(true);
    try {
        const categoryNames = categories.map(c => c.name);
        const parsed = await parseExpenseImage(uri, categoryNames, true, base64); 
        
        if (parsed) {
            setItems(parsed.map((p, index) => ({
                ...p,
                id: Date.now().toString() + index,
                assignedTo: [] 
            })));
            setBillName(`Bill ${new Date().toLocaleDateString('id-ID')}`);
            setStep('review');
        } else {
            Alert.alert('Gagal', 'Tidak bisa membaca struk. Coba lagi.');
        }
    } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Terjadi kesalahan saat memproses gambar.');
    } finally {
        setLoading(false);
    }
  };

  const addFriend = () => {
      if (!newFriendName.trim()) return;
      setFriends([...friends, { id: Date.now().toString(), name: newFriendName, isMe: false }]);
      setNewFriendName('');
  };

  const removeFriend = (id: string) => {
      if (id === 'me') return;
      setFriends(friends.filter(f => f.id !== id));
      setItems(items.map(i => ({
          ...i,
          assignedTo: i.assignedTo.filter(fid => fid !== id)
      })));
  };

  const toggleAssignment = (itemId: string, friendId: string) => {
      setItems(items.map(item => {
          if (item.id === itemId) {
              const isAssigned = item.assignedTo.includes(friendId);
              return {
                  ...item,
                  assignedTo: isAssigned 
                      ? item.assignedTo.filter(id => id !== friendId)
                      : [...item.assignedTo, friendId]
              };
          }
          return item;
      }));
  };
  
  const selectAllForFriend = (friendId: string) => {
      const allAssigned = items.every(i => i.assignedTo.includes(friendId));
      setItems(items.map(i => ({
          ...i,
          assignedTo: allAssigned 
            ? i.assignedTo.filter(id => id !== friendId)
            : [...new Set([...i.assignedTo, friendId])]
      })));
  };

  const calculateShare = (friendId: string) => {
      let total = 0;
      items.forEach(item => {
          if (item.assignedTo.includes(friendId)) {
              total += item.amount / item.assignedTo.length;
          }
      });
      return total;
  };

  const saveBill = async (saveMyShareToExpenses: boolean) => {
      setLoading(true);
      try {
          const totalBill = items.reduce((sum, item) => sum + item.amount, 0);
          
          const memberShares: Record<string, number> = {};
          friends.forEach(f => {
              memberShares[f.id] = calculateShare(f.id);
          });

          const billData = {
              name: billName || 'Split Bill',
              date: new Date().toISOString(),
              total_amount: totalBill,
              image_uri: imageUri ?? undefined
          };

          const membersData = friends.map(f => ({
              name: f.name,
              share_amount: memberShares[f.id],
              is_me: f.isMe
          }));

          await addSplitBill(db, billData, membersData);

          if (saveMyShareToExpenses) {
              const myShare = memberShares['me'];

              
              if (myShare > 0) {
                  const foodCategory = categories.find(c => c.name.toLowerCase().includes('makan'));
                  const categoryId = foodCategory ? foodCategory.id : (categories[0]?.id || 1);


                  await addExpense(db, {
                      category_id: categoryId,
                      amount: myShare,
                      date: new Date().toISOString(),
                      note: `Split Bill: ${billName}`,
                      image_uri: imageUri ?? undefined
                  });

              } else {
                  Alert.alert('Info', 'Tidak ada item yang di-assign ke "Saya", jadi tidak ada yang ditambahkan ke pengeluaran.');
              }
          }
          
          Alert.alert('Sukses', 'Split Bill berhasil disimpan!');
          handleClose();

      } catch (error) {
          console.error(error);
          Alert.alert('Error', 'Gagal menyimpan data.');
      } finally {
          setLoading(false);
      }
  };


  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/50" onPress={handleClose} />
        <View className={`bg-background w-full rounded-t-[32px] overflow-hidden ${step === 'upload' ? 'pb-6' : 'h-[90%]'}`}>
            {/* Header - Better spacing */}
            <View className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-row justify-between items-center">
                <Text className="font-bold text-lg">
                    {step === 'upload' ? 'Upload Struk' : 
                     step === 'review' ? 'Review Item' :
                     step === 'members' ? 'Tambah Teman' :
                     step === 'assign' ? 'Bagi Item' : 'Ringkasan'}
                </Text>
                <View className="items-end">
                    {(step === 'review' || step === 'members' || step === 'assign') && (
                        <Pressable onPress={() => {
                            if (step === 'review') setStep('members');
                            else if (step === 'members') setStep('assign');
                            else if (step === 'assign') setStep('summary');
                        }}>
                            <Text className="text-primary font-bold text-base">Lanjut</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Content */}
            <View className={step === 'upload' ? '' : 'flex-1'}>
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={colorScheme === 'dark' ? 'white' : 'black'} />
                        <Text className="mt-4 text-gray-500">Memproses...</Text>
                    </View>
                ) : (
                    <>
                        {/* Step 1: Upload */}
                        {step === 'upload' && (
                            <View className="px-6 py-6">
                                <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl mb-6">
                                    <Text className="text-sm text-blue-900 dark:text-blue-100 mb-1 font-semibold">
                                        📸 Tips untuk hasil terbaik:
                                    </Text>
                                    <Text className="text-xs text-blue-700 dark:text-blue-300">
                                        • Pastikan foto jelas dan terang{'\n'}
                                        • Total amount harus terlihat{'\n'}
                                        • Hindari bayangan atau refleksi
                                    </Text>
                                </View>

                                <View className="gap-3">
                                    <Pressable 
                                        onPress={takePhoto}
                                        className="w-full py-3.5 rounded-full items-center justify-center bg-black dark:bg-white flex-row gap-2"
                                    >
                                        <Icon name="camera.fill" size={18} color={colorScheme === 'dark' ? 'black' : 'white'} />
                                        <Text className="text-white dark:text-black font-bold">Ambil Foto</Text>
                                    </Pressable>

                                    <Pressable 
                                        onPress={pickImage}
                                        className="w-full py-3.5 rounded-full items-center justify-center bg-gray-200 dark:bg-gray-800 flex-row gap-2"
                                    >
                                        <Icon name="photo.fill" size={18} color={colorScheme === 'dark' ? 'white' : 'black'} />
                                        <Text className="text-black dark:text-white font-bold">Pilih dari Galeri</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}

                        {/* Step 2: Review Items - FIXED spacing */}
                        {step === 'review' && (
                            <ScrollView className="flex-1 px-5 pt-4">
                                <View className="mb-4">
                                    <Text className="text-gray-500 text-xs uppercase mb-1">Nama Bill</Text>
                                    <TextInput 
                                        value={billName}
                                        onChangeText={setBillName}
                                        className="text-lg font-bold font-sans border-b border-gray-200 pb-2 text-black dark:text-white"
                                        placeholder="Contoh: Traktiran Ultah"
                                    />
                                </View>
                                <Text className="font-bold text-base mb-3">Daftar Item ({items.length})</Text>
                                
                                {items.map((item, idx) => (
                                    <View key={item.id} className="flex-row items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                                        <View className="flex-1 pr-3">
                                            {/* Name and Price on SAME ROW */}
                                            <View className="flex-row justify-between items-center">
                                                <TextInput 
                                                    value={item.name}
                                                    onChangeText={(txt) => {
                                                        const newItems = [...items];
                                                        newItems[idx].name = txt;
                                                        setItems(newItems);
                                                    }}
                                                    className="font-medium font-sans text-black dark:text-white flex-1"
                                                />
                                                <TextInput 
                                                    value={item.amount.toString()}
                                                    keyboardType="numeric"
                                                    onChangeText={(txt) => {
                                                        const newItems = [...items];
                                                        newItems[idx].amount = parseInt(txt) || 0;
                                                        setItems(newItems);
                                                    }}
                                                    className="text-gray-600 dark:text-gray-400 text-right w-24 font-sans"
                                                />
                                            </View>
                                        </View>
                                        <Pressable 
                                            hitSlop={8}
                                            onPress={() => setItems(items.filter((_, i) => i !== idx))}
                                            className="ml-2"
                                        >
                                            <Icon name="xmark.circle.fill" size={18} color="#9CA3AF" />
                                        </Pressable>
                                    </View>
                                ))}
                                <Pressable 
                                    className="flex-row items-center justify-center py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl mb-8 mt-3"
                                    onPress={() => {
                                        setItems([...items, { name: 'Item Baru', category: 'Lainnya', amount: 0, id: Date.now().toString(), assignedTo: [] }]);
                                    }}
                                >
                                    <Icon name="plus" size={14} color="gray" />
                                    <Text className="text-gray-500 ml-2 text-sm">Tambah Item Manual</Text>
                                </Pressable>
                            </ScrollView>
                        )}

                        {/* Step 3: Members */}
                        {step === 'members' && (
                            <View className="flex-1 px-5 pt-4">
                                 <View className="flex-row gap-2 mb-4">
                                    <TextInput 
                                        className="flex-1 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl text-black dark:text-white font-sans"
                                        placeholder="Nama Teman"
                                        placeholderTextColor="#9CA3AF"
                                        value={newFriendName}
                                        onChangeText={setNewFriendName}
                                    />
                                    <Pressable 
                                        className="bg-black dark:bg-white w-12 items-center justify-center rounded-xl"
                                        onPress={addFriend}
                                    >
                                        <Icon name="plus" size={20} color={colorScheme === 'dark' ? 'black' : 'white'} />
                                    </Pressable>
                                 </View>

                                 <Text className="font-bold mb-3">Daftar Orang ({friends.length})</Text>
                                 <ScrollView>
                                     <View className="flex-row flex-wrap gap-2">
                                         {friends.map(friend => (
                                             <View key={friend.id} className={`flex-row items-center px-3 py-2 rounded-full ${friend.isMe ? 'bg-black dark:bg-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                                 <Text className={`text-sm mr-1 ${friend.isMe ? 'text-white dark:text-black font-medium' : 'text-black dark:text-white'}`}>{friend.name}</Text>
                                                 {!friend.isMe && (
                                                     <Pressable onPress={() => removeFriend(friend.id)} hitSlop={5}>
                                                         <Icon name="xmark" size={10} color="gray" />
                                                     </Pressable>
                                                 )}
                                             </View>
                                         ))}
                                     </View>
                                 </ScrollView>
                            </View>
                        )}

                        {/* Step 4: Assign */}
                        {step === 'assign' && (
                            <View className="flex-1">
                                <View className="h-14 border-b border-gray-100 dark:border-gray-800">
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}>
                                        {friends.map(friend => (
                                            <Pressable 
                                                key={friend.id}
                                                onPress={() => selectAllForFriend(friend.id)}
                                                className="mr-2"
                                            >
                                                <View className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                                                    <Text className="text-xs text-black dark:text-white">{friend.name}</Text>
                                                </View>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                </View>

                                <ScrollView className="flex-1 px-5 pt-3">
                                    {items.map(item => (
                                        <View key={item.id} className="mb-4">
                                            <View className="flex-row justify-between items-center mb-2">
                                                <Text className="font-medium">{item.name}</Text>
                                                <Text className="text-gray-500 text-sm">Rp {item.amount.toLocaleString('id-ID')}</Text>
                                            </View>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                                {friends.map(friend => {
                                                    const isSelected = item.assignedTo.includes(friend.id);
                                                    return (
                                                        <Pressable 
                                                            key={friend.id}
                                                            onPress={() => toggleAssignment(item.id, friend.id)}
                                                            className={`px-3 py-1 rounded-lg border ${isSelected ? 'bg-black border-black dark:bg-white dark:border-white' : 'border-gray-200 dark:border-gray-700'}`}
                                                        >
                                                            <Text className={`text-xs ${isSelected ? 'text-white dark:text-black font-medium' : 'text-gray-500'}`}>
                                                                {friend.name}
                                                            </Text>
                                                        </Pressable>
                                                    )
                                                })}
                                            </ScrollView>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Step 5: Summary */}
                        {step === 'summary' && (
                            <View className="flex-1 px-5 pt-4">
                                <ScrollView>
                                    {friends.map(friend => {
                                        const total = calculateShare(friend.id);

                                        return (
                                            <View key={friend.id} className="flex-row justify-between items-center p-3 bg-white dark:bg-gray-900 rounded-xl mb-2 border border-gray-100 dark:border-gray-800">
                                                <View className="flex-row items-center gap-3">
                                                    <View className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center">
                                                        <Text className="font-bold">{friend.name[0]}</Text>
                                                    </View>
                                                    <View>
                                                        <Text className="font-medium">{friend.name}</Text>
                                                        <Text className="text-gray-500 text-xs">{friend.isMe ? 'Saya' : 'Teman'}</Text>
                                                    </View>
                                                </View>
                                                <Text className="font-bold text-black dark:text-white">Rp {Math.ceil(total).toLocaleString('id-ID')}</Text>
                                            </View>
                                        );
                                    })}

                                    <View className="mt-6 gap-3 mb-8">
                                        <Pressable 
                                            className="bg-black dark:bg-white w-full py-3.5 rounded-2xl items-center"
                                            onPress={() => saveBill(false)}
                                        >
                                            <Text className="text-white dark:text-black font-bold">Simpan Saja</Text>
                                        </Pressable>
                                        <Pressable 
                                            className="bg-white dark:bg-gray-900 border-2 border-black dark:border-white w-full py-3.5 rounded-2xl items-center"
                                            onPress={() => saveBill(true)}
                                        >
                                            <Text className="text-black dark:text-white font-bold">Simpan & Masukkan ke Pengeluaran</Text>
                                        </Pressable>
                                    </View>
                                </ScrollView>
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
      </View>
    </Modal>
  );
}
