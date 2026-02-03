**myuang** is a smart, offline-first personal expense tracker designed for speed and simplicity. Built with React Native and Expo, it leverages AI to make tracking your spending effortless.

## 🚀 Features

- **⚡ Quick Add & Smart Text**: Type naturally (e.g., *"Nasi goreng 15rb"*) and let Google Gemini AI parse the category, item name, and amount automatically.
- **📸 AI Receipt Scanning (OCR)**: Snap a photo of your receipt. 
- **📊 Insightful Analysis**: Visualize your spending habits with weekly and monthly breakdowns, filtered by categories.
- **📶 Offline-First**: Works perfectly without an internet connection. AI features gracefully disable when offline.
- **🌗 Dark Mode**: Sleek, battery-friendly dark theme by default.
- **🔔 Custom Reminders**: Never forget to track! Get notified at 8 PM if you haven't logged any expenses for the day.
- **💸 Split Bill**: Easily calculate and track your share of shared expenses.
- **🎤 Voice Recognizer**: Record expenses hands-free using voice input.
## 🛠 Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) (Expo SDK 50+)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Database**: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (Local, Offline)
- **AI Integration**: [Google Gemini API](https://ai.google.dev/) (Generative AI & Vision)

## 📦 Installation

Prerequisites:
- Node.js (LTS recommended)
- npm or yarn
- Expo Go app on your physical device, or an Android/iOS Simulator.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/pengeluarangw.git
    cd pengeluarangw
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory (if required) and add your API keys:
    ```env
    EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
    ```

4.  **Run the app:**
    ```bash
    npx expo start
    ```
    - Press `a` for Android Emulator.
    - Press `i` for iOS Simulator.
    - Scan the QR code with Expo Go on your phone.

## 📂 Database Schema

The app uses a lightweight SQLite database for local storage.

### `transactions`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `amount` | REAL | Expense amount |
| `category_id` | INTEGER | Foreign Key to Categories |
| `date` | TEXT | ISO Date String |
| `note` | TEXT | Description of expense |
| `image_uri` | TEXT | Path to receipt image (optional) |

### `categories`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key |
| `name` | TEXT | Category name (e.g., Makan, Transport) |
| `icon` | TEXT | Icon identifier |
| `color` | TEXT | Hex color code |

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## 📄 License

This project is for personal use and education.
