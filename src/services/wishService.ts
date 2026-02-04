import { Wish } from '../types';

const LOCAL_WISHES_KEY = 'lunaflow_community_wishes';

// Credentials storage keys
export const STORAGE_BIN_ID = 'LUNA_JSONBIN_ID';
export const STORAGE_API_KEY = 'LUNA_JSONBIN_KEY';

// Mock initial data
const MOCK_WISHES: Wish[] = [
    { id: '1', text: 'Add pregnancy mode', votes: 124, status: 'pending', createdAt: Date.now() - 10000000 },
    { id: '2', text: 'Dark mode support', votes: 89, status: 'approved', createdAt: Date.now() - 5000000 },
    { id: '3', text: 'Export to PDF for doctor', votes: 45, status: 'pending', createdAt: Date.now() - 2000000 },
];

// Helper to get headers
const getHeaders = (apiKey: string) => ({
    'Content-Type': 'application/json',
    'X-Master-Key': apiKey,
    // 'X-Bin-Versioning': 'false' // Optional: disable versioning to save space on jsonbin
});

export const fetchWishes = async (): Promise<Wish[]> => {
    const binId = localStorage.getItem(STORAGE_BIN_ID);
    const apiKey = localStorage.getItem(STORAGE_API_KEY);

    // 1. If no keys, use Local Mock
    if (!binId || !apiKey) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const stored = localStorage.getItem(LOCAL_WISHES_KEY);
                resolve(stored ? JSON.parse(stored) : MOCK_WISHES);
            }, 600);
        });
    }

    // 2. Real API Call
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            method: 'GET',
            headers: { 'X-Master-Key': apiKey }
        });

        if (!response.ok) throw new Error('Failed to fetch bin');

        const data = await response.json();
        // JSONBin v3 wraps data in a 'record' property
        const wishes = Array.isArray(data.record) ? data.record : [];
        return wishes;
    } catch (e) {
        console.error("JSONBin Fetch Error:", e);
        // Fallback to empty or mock on error to prevent app crash
        return [];
    }
};

export const submitWish = async (text: string): Promise<Wish[]> => {
    const binId = localStorage.getItem(STORAGE_BIN_ID);
    const apiKey = localStorage.getItem(STORAGE_API_KEY);

    // MOCK MODE
    if (!binId || !apiKey) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const newWish: Wish = {
                    id: Date.now().toString(),
                    text,
                    votes: 1,
                    status: 'pending',
                    createdAt: Date.now()
                };
                const stored = localStorage.getItem(LOCAL_WISHES_KEY);
                const current = stored ? JSON.parse(stored) : MOCK_WISHES;
                const updated = [newWish, ...current];
                localStorage.setItem(LOCAL_WISHES_KEY, JSON.stringify(updated));
                resolve(updated);
            }, 600);
        });
    }

    // REAL MODE
    // Strategy: Fetch Latest -> Append -> Put Back
    try {
        // 1. Get current
        const currentList = await fetchWishes();
        
        // 2. Create new
        const newWish: Wish = {
            id: Date.now().toString(),
            text,
            votes: 1,
            status: 'pending',
            createdAt: Date.now()
        };
        
        const updatedList = [newWish, ...currentList];

        // 3. Update Bin
        await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: getHeaders(apiKey),
            body: JSON.stringify(updatedList)
        });

        return updatedList;
    } catch (e) {
        console.error("JSONBin Write Error:", e);
        throw e;
    }
};

export const voteWish = async (id: string): Promise<Wish[]> => {
    const binId = localStorage.getItem(STORAGE_BIN_ID);
    const apiKey = localStorage.getItem(STORAGE_API_KEY);

    // MOCK MODE
    if (!binId || !apiKey) {
        return new Promise((resolve) => {
            const stored = localStorage.getItem(LOCAL_WISHES_KEY);
            const list: Wish[] = stored ? JSON.parse(stored) : MOCK_WISHES;
            const updated = list.map(w => w.id === id ? { ...w, votes: w.votes + 1 } : w);
            updated.sort((a, b) => b.votes - a.votes);
            localStorage.setItem(LOCAL_WISHES_KEY, JSON.stringify(updated));
            resolve(updated);
        });
    }

    // REAL MODE
    try {
        // 1. Get current (fresh fetch to minimize race conditions)
        const currentList = await fetchWishes();
        
        // 2. Modify
        const updatedList = currentList.map(w => w.id === id ? { ...w, votes: w.votes + 1 } : w);
        updatedList.sort((a, b) => b.votes - a.votes);

        // 3. Update Bin
        await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: getHeaders(apiKey),
            body: JSON.stringify(updatedList)
        });

        return updatedList;
    } catch (e) {
        console.error("JSONBin Vote Error:", e);
        throw e;
    }
}
