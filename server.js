const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = []; 
let playerNames = {}; 
let currentBombHolder = null; 
let timerInterval = null;
let lastThrowTime = 0; 
let isPlaying = false; // ⭐ [핵심 방어막] 게임 진행 상태를 잠그는 변수 추가

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
        if (players.length === 0) return; 
        let timeLeft = 30; 
        isPlaying = true; // ⭐ 게임 시작 시 자물쇠 해제!
        
        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');

        if (realPlayers.length > 0) {
            currentBombHolder = realPlayers[0]; 
            io.to(currentBombHolder).emit('receiveBomb');
        }

        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            timeLeft--;
            io.emit('timerUpdate', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                isPlaying = false; // ⭐ 0초가 되는 순간 자물쇠 철컥! (이후 조작 불가)
                io.emit('explode'); 
                currentBombHolder = null; 
            }
        }, 1000);
    });

    socket.on('throwBomb', () => {
        if (!isPlaying) return; // ⭐ [핵심 방어 1] 터진 이후에는 던지기 신호 무조건 무시!
        if (socket.id !== currentBombHolder) return; 

        const now = Date.now();
        if (now - lastThrowTime < 300) return;
        lastThrowTime = now;

        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');
        
        if (realPlayers.length > 1) {
            let currentIndex = realPlayers.indexOf(currentBombHolder);
            if (currentIndex === -1) currentIndex = 0; 
            
            let nextIndex = (currentIndex + 1) % realPlayers.length;
            currentBombHolder = realPlayers[nextIndex]; 
            io.to(currentBombHolder).emit('receiveBomb');
        } else if (realPlayers.length === 1) {
            io.to(currentBombHolder).emit('receiveBomb');
        }
    });

    socket.on('disconnect', () => {
        const wasBombHolder = (socket.id === currentBombHolder); 
        
        players = players.filter(id => id !== socket.id);
        delete playerNames[socket.id];
        broadcastPlayerList(); 

        if (isPlaying && wasBombHolder && timerInterval) { // ⭐ 게임 진행 중일 때만 강제 할당
            const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');
            if (realPlayers.length > 0) {
                currentBombHolder = realPlayers[0]; 
                io.to(currentBombHolder).emit('receiveBomb');
            } else {
                currentBombHolder = null;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
