// @ts-ignore
import * as FileSystem from 'expo-file-system/legacy';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
console.log('Gemini API Key loaded:', API_KEY ? 'Yes (' + API_KEY.length + ' chars)' : 'No');
const genAI = new GoogleGenerativeAI(API_KEY || '');

export interface ParsedExpense {
  name: string;
  category: string;
  amount: number;
  type?: 'expense' | 'income';
}

export async function parseExpenseText(text: string, availableCategories: string[], incomeCategories: string[] = []): Promise<ParsedExpense | null> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const categoriesStr = availableCategories.join(', ');
    const incomeCategoriesStr = incomeCategories.join(', ');
    
    const prompt = `Analisis teks transaksi keuangan ini: "${text}".
    Extract informasi menjadi JSON: { "name": "nama item", "category": "kategori", "amount": angka, "type": "expense" atau "income" }
    
    PENTING: Tentukan apakah ini PEMASUKAN (income) atau PENGELUARAN (expense):
    - Income keywords: gaji, salary, transfer masuk, terima, dapat, bonus, freelance, investasi, dividen, hadiah
    - Expense keywords: beli, bayar, belanja, makan, bensin, transport, dll
    
    Kategori untuk Pengeluaran: ${categoriesStr}
    Kategori untuk Pemasukan: ${incomeCategoriesStr || 'Gaji, Freelance, Investasi, Bonus, Transfer, Hadiah, Lainnya'}
    
    Rules:
    - amount harus angka (contoh: 15000)
    - Gunakan kategori yang paling sesuai berdasarkan type
    - Return hanya JSON valid, tanpa markdown.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Determine type if not specified
    const transactionType = parsed.type === 'income' ? 'income' : 'expense';
    const categoryList = transactionType === 'income' ? incomeCategories : availableCategories;
    
    // Normalize category
    if (!categoryList.includes(parsed.category)) {
        const match = categoryList.find(c => c.toLowerCase() === parsed.category.toLowerCase());
        parsed.category = match || categoryList[0] || 'Lainnya';
    }
    
    return {
        name: parsed.name,
        category: parsed.category,
        amount: Number(parsed.amount),
        type: transactionType
    };
  } catch (error) {
    console.error('Error parsing text:', error);
    return null;
  }
}

export async function parseExpenseImage(imageUri: string, availableCategories: string[], splitItems: boolean = true, base64Data?: string | null): Promise<ParsedExpense[] | null> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let finalBase64 = base64Data;
    
    if (!finalBase64) {
        try {
            finalBase64 = await FileSystem.readAsStringAsync(imageUri, {
                encoding: 'base64',
            });
        } catch (e) {
            console.error('FileSystem read failed:', e);
            throw new Error('Failed to read image file. Please ensure Base64 is passed.');
        }
    }

    const categoriesStr = availableCategories.join(', ');

    const prompt = splitItems 
      ? `Kamu adalah asisten untuk aplikasi pencatat pengeluaran. Analisis gambar struk/nota/kwitansi ini dan extract SEMUA item pengeluaran.
// ... rest of prompt same ...

Parse menjadi JSON ARRAY dengan format: [
  { "name": "nama item", "category": "kategori", "amount": angka },
  { "name": "nama item 2", "category": "kategori", "amount": angka }
]

Kategori yang tersedia: ${categoriesStr}

Rules:
- Extract SETIAP ITEM dengan harga masing-masing
- Jangan gabungkan item berbeda
- amount = harga per item (bukan total)
- Gunakan kategori yang paling sesuai untuk SETIAP item
- Jika hanya ada 1 item atau total, return array dengan 1 item saja

Contoh:
Struk dengan "Nasi Goreng Rp 15.000, Es Teh Rp 5.000" →
[{"name":"Nasi Goreng","category":"Makanan & Minuman","amount":15000}, {"name":"Es Teh","category":"Makanan & Minuman","amount":5000}]

PENTING: Return JSON array saja, tanpa penjelasan.`
      : `Kamu adalah asisten untuk aplikasi pencatat pengeluaran. Analisis gambar struk/nota/kwitansi ini dan extract informasi pengeluaran.

Parse menjadi JSON dengan format: { "name": "nama item/merchant", "category": "kategori", "amount": total_amount_angka }

Kategori yang tersedia: ${categoriesStr}

Rules:
- Ambil TOTAL amount (bukan subtotal)
- Jika ada multiple items, ambil yang paling dominan atau merchant name
- amount harus angka tanpa format (contoh: 15000, bukan "15.000" atau "15k")
- Gunakan kategori yang paling sesuai dari list yang tersedia

PENTING: Hanya return JSON saja, tanpa penjelasan tambahan.`;

    const imagePart = {
      inlineData: {
        data: finalBase64 as string,
        mimeType: 'image/jpeg',
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    

    
    // Try to extract JSON
    let jsonMatch = text.match(/\[[\s\S]*?\]/); // Try array first
    if (!jsonMatch && !splitItems) {
      jsonMatch = text.match(/\{[^}]+\}/); // Fallback to single object
    }
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    let parsedData = JSON.parse(jsonMatch[0]);
    
    // Ensure it's always an array
    const expenses: ParsedExpense[] = Array.isArray(parsedData) ? parsedData : [parsedData];
    
    // Validate and normalize each expense
    // Validate and normalize each expense
    const validExpenses = expenses
      .filter(exp => exp.name && exp.amount && exp.amount > 0)
      .map(exp => {
        // Normalize category
        if (!availableCategories.includes(exp.category)) {
          const matchedCategory = availableCategories.find(c => 
            c.toLowerCase() === exp.category.toLowerCase()
          );
          exp.category = matchedCategory || availableCategories[0] || 'Lainnya';
        }
        return exp;
      });

    // Group items with same name
    // Group items with same name
    const expenseMap = new Map<string, ParsedExpense>();
    const countMap = new Map<string, number>();

    validExpenses.forEach(exp => {
      const normalizedName = exp.name.trim().toLowerCase();
      
      if (expenseMap.has(normalizedName)) {
        // Merge with existing item
        const existing = expenseMap.get(normalizedName)!;
        existing.amount += exp.amount;
        
        // Increment count
        const currentCount = countMap.get(normalizedName) || 1;
        countMap.set(normalizedName, currentCount + 1);
      } else {
        // Add new item - Ensure name is pretty (Title Case if needed)
        // Simple distinct logic: If name is ALL CAPS or all lower, title case it.
        let prettyName = exp.name.trim();
        if (prettyName === prettyName.toUpperCase() || prettyName === prettyName.toLowerCase()) {
           prettyName = prettyName.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
        }
        
        expenseMap.set(normalizedName, { ...exp, name: prettyName });
        countMap.set(normalizedName, 1);
      }
    });

    // Convert back to array and append count if > 1
    return Array.from(expenseMap.entries()).map(([key, value]) => {
      const count = countMap.get(key) || 1;
      if (count > 1) {
        return {
          ...value,
          name: `${value.name} (x${count})`
        };
      }
      return value;
    });
  } catch (error) {
    console.error('Error parsing expense image:', error);
    return null;
  }
}
