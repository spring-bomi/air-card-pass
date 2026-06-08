const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = []; 
let playerNames = {}; 
let currentBombHolder = null; // ⭐ 현재 폭탄을 들고 있는 사람의 ID를 추적
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
        if (players.length === 0) return; 
        let timeLeft = 30; 
        
        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');

        if (realPlayers.length > 0) {
            // ⭐ 첫 번째 사람에게 폭탄을 주고 누군지 기록해둠
            currentBombHolder = realPlayers[0]; 
            io.to(currentBombHolder).emit('receiveBomb');
        }

        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            timeLeft--;
            io.emit('timerUpdate', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                currentBombHolder = null; // 게임 끝나면 초기화
                io.emit('explode'); 
            }
        }, 1000);
    });

    socket.on('throwBomb', () => {
        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');
        if (realPlayers.length > 0) {
            // ⭐ 현재 폭탄을 든 사람의 위치를 찾아서 다음 사람에게 정확히 전달
            let currentIndex = realPlayers.indexOf(currentBombHolder);
            if (currentIndex === -1) currentIndex = 0; 
            
            let nextIndex = (currentIndex + 1) % realPlayers.length;
            currentBombHolder = realPlayers[nextIndex]; // 새 주인 기록
            io.to(currentBombHolder).emit('receiveBomb');
        }
    });

    socket.on('disconnect', () => {
        // ⭐ 나간 사람이 하필 '폭탄을 쥐고 있던 사람'인지 확인
        const wasBombHolder = (socket.id === currentBombHolder); 
        
        players = players.filter(id => id !== socket.id);
        delete playerNames[socket.id];
        broadcastPlayerList(); 

        // ⭐ 폭탄을 든 채로 도망갔다면? 남아있는 사람 중 1번에게 폭탄을 강제 배송!
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
