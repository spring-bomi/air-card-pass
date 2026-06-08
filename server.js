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
let lastThrowTime = 0; // ⭐ 추가: 따닥(더블터치) 방지용 쿨타임 기록

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
                currentBombHolder = null; 
                io.emit('explode'); 
            }
        }, 1000);
    });

    socket.on('throwBomb', () => {
        // ⭐ [핵심 방어 1] 내 손에 진짜 폭탄이 쥐어져 있을 때만 던질 수 있음 (서버 꼬임 완벽 차단)
        if (socket.id !== currentBombHolder) return;

        // ⭐ [핵심 방어 2] 0.3초 이내에 연속으로 발생한 요청 무시 (다급한 더블 스와이프 무시)
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
            // 혼자 남았을 때 던지면 그대로 다시 자기 자신에게 돌아옴
            io.to(currentBombHolder).emit('receiveBomb');
        }
    });

    socket.on('disconnect', () => {
        const wasBombHolder = (socket.id === currentBombHolder); 
        
        players = players.filter(id => id !== socket.id);
        delete playerNames[socket.id];
        broadcastPlayerList(); 

        // 폭탄을 든 사람이 나가버렸을 때 남은 사람에게 강제 할당
        if (wasBombHolder && timerInterval) {
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
