const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// ⭐ Vercel 통신을 위해 반드시 필요한 CORS 설정 추가!
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = []; 
let playerNames = {}; 
let hasBombIndex = 0;
let timerInterval = null;

io.on('connection', (socket) => {
    players.push(socket.id);
    playerNames[socket.id] = "대기중...";

    socket.on('setNickname', (nickname) => {
        playerNames[socket.id] = nickname;
        broadcastPlayerList();
    });

    socket.on('registerDisplay', () => {
        playerNames[socket.id] = 'DISPLAY';
        broadcastPlayerList();
    });

    function broadcastPlayerList() {
        const list = players.map(id => playerNames[id]).filter(name => name !== 'DISPLAY' && name !== '대기중...');
        io.emit('updatePlayerList', list);
    }

    socket.on('startGame', () => {
        // ⭐ 방어 로직 수정: 배열의 길이를 정확히 확인하도록 변경
        if (players.length === 0) return; 
        let timeLeft = 30; 
        
        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');

        if (realPlayers.length > 0) {
            hasBombIndex = 0; 
            io.to(realPlayers[hasBombIndex]).emit('receiveBomb');
        }

        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            timeLeft--;
            io.emit('timerUpdate', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                io.emit('explode'); 
            }
        }, 1000);
    });

    socket.on('throwBomb', () => {
        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');
        if (realPlayers.length > 0) {
            hasBombIndex = (hasBombIndex + 1) % realPlayers.length;
            io.to(realPlayers[hasBombIndex]).emit('receiveBomb');
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(id => id !== socket.id);
        delete playerNames[socket.id];
        broadcastPlayerList(); 
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
