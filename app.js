import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js';
import { 
    getDatabase, 
    ref, 
    push, 
    onValue, 
    onDisconnect,
    set 
} from 'https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@2.4.3/dist/purify.min.js';


const firebaseConfig = {
    apiKey: "AIzaSyDoYJUZvfODd9uqzMvH0Drw3fz6ruZJfBI",
    authDomain: "ewninyarg.firebaseapp.com",
    databaseURL: "https://ewninyarg-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ewninyarg",
    storageBucket: "ewninyarg.firebasestorage.app",
    messagingSenderId: "1092242784203",
    appId: "1:1092242784203:web:9561a4a6a300650bc5804e",
    measurementId: "G-2GDKKQVPV0"
};

class CyberChat {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.db = getDatabase(this.app);
        this.messagesRef = ref(this.db, 'messages');
        this.userId = this.generateUserId();
        this.presenceRef = null;
        this.messages = [];
        this.initMatrix();
        this.initChat();
        this.setupPresence();
    }

    // ==================== Security ====================
    sanitize(input) {
        return DOMPurify.sanitize(input, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
            FORBID_TAGS: ['style', 'script', 'iframe'],
            KEEP_CONTENT: false
        });
    }

    // ==================== User System ====================
    generateUserId() {
        const storedId = localStorage.getItem('anonymousId');
        if(storedId) return this.sanitize(storedId);
        
        const newId = 'user-' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('anonymousId', newId);
        return newId;
    }

    async updateNickname(newNick) {
        const sanitizedNick = this.sanitize(newNick.substring(0, 20));
        this.userId = sanitizedNick;
        localStorage.setItem('anonymousId', sanitizedNick);
        
        if(this.presenceRef) {
            try {
                await set(this.presenceRef, sanitizedNick);
                this.updateMessagesUserId(sanitizedNick);
            } catch(error) {
                console.error('Nick update error:', error);
            }
        }
    }

    // ==================== Matrix Animation ====================
    initMatrix() {
        const canvas = document.getElementById('matrixCanvas');
        if(!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()";
        const drops = new Array(Math.floor(canvas.width/20)).fill(0);

        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#0F0';
            ctx.font = '20px monospace';

            drops.forEach((y, i) => {
                ctx.fillText(
                    chars[Math.floor(Math.random()*chars.length)],
                    i*20,
                    y*20
                );
                drops[i] = y > canvas.height/20 ? 0 : y + 1.5;
            });

            requestAnimationFrame(draw);
        };
        
        draw();
    }

    // ==================== Chat System ====================
    initChat() {
        this.setupChatForm();
        this.setupMessageListener();
    }

    setupChatForm() {
        const form = document.getElementById('chatForm');
        const input = document.querySelector('.chat-input');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = input.value.trim();
            if(!message) return;

            if(message.startsWith('/nick ')) {
                const newNick = message.split(' ')[1];
                if(newNick) this.updateNickname(newNick);
            } else {
                this.sendMessage(message);
            }
            input.value = '';
        });
    }

    setupMessageListener() {
        onValue(this.messagesRef, (snapshot) => {
            this.messages = Object.values(snapshot.val() || {});
            this.renderChat();
        });
    }

    async sendMessage(content) {
        try {
            await push(this.messagesRef, {
                userId: this.userId,
                content: this.sanitize(content),
                timestamp: Date.now()
            });
        } catch(error) {
            console.error("Message send error:", error);
            alert('Ошибка отправки сообщения');
        }
    }

    updateMessagesUserId(newId) {
        this.messages = this.messages.map(msg => {
            if(msg.userId === this.userId) {
                return { ...msg, userId: newId };
            }
            return msg;
        });
        this.renderChat();
    }

    renderChat() {
        const container = document.querySelector('.chat-container');
        container.innerHTML = '';
        
        this.messages.forEach(msg => {
            const msgElement = document.createElement('div');
            msgElement.className = `message ${msg.userId === this.userId ? 'self' : ''}`;
            
            const header = document.createElement('div');
            header.className = 'msg-header';
            
            const userIdSpan = document.createElement('span');
            userIdSpan.className = 'user-id';
            userIdSpan.textContent = this.sanitize(msg.userId);
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'time';
            timeSpan.textContent = new Date(msg.timestamp).toLocaleTimeString();
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'msg-content';
            contentDiv.textContent = this.sanitize(msg.content);
            
            header.append(userIdSpan, timeSpan);
            msgElement.append(header, contentDiv);
            container.appendChild(msgElement);
        });
        
        container.scrollTop = container.scrollHeight;
    }

    // ==================== Presence System ====================
    setupPresence() {
        try {
            const connectionsRef = ref(this.db, 'connections');
            this.presenceRef = push(connectionsRef);
            
            set(this.presenceRef, this.userId)
                .catch(error => console.error('Presence error:', error));

            onDisconnect(this.presenceRef).remove()
                .catch(error => console.error('OnDisconnect error:', error));

            onValue(connectionsRef, (snapshot) => {
                const users = [];
                snapshot.forEach(child => {
                    const val = child.val();
                    if(val) users.push(this.sanitize(val));
                });
                this.renderOnlineUsers(users);
            });
        } catch(error) {
            console.error('Presence system error:', error);
        }
    }

    renderOnlineUsers(users) {
        const countElement = document.getElementById('onlineCount');
        if(countElement) {
            countElement.textContent = users.length;
        }
    }
}

// Инициализация приложения
window.addEventListener('DOMContentLoaded', () => {
    new CyberChat();
});