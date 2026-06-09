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
let isPlaying = false; 

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
        if (players.length === 0 || isPlaying) return; 
        isPlaying = true; 
        
        if (timerInterval) clearInterval(timerInterval);

        let preCount = 3;
        io.emit('preCountdown', preCount); 

        const preInterval = setInterval(() => {
            preCount--;
            if (preCount > 0) {
                io.emit('preCountdown', preCount);
            } else {
                clearInterval(preInterval);
                
                let timeLeft = 30; 
                const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');

                if (realPlayers.length > 0) {
                    // ⭐ [변경됨] 첫 번째 폭탄 소지자도 랜덤으로 선택!
                    const randomIndex = Math.floor(Math.random() * realPlayers.length);
                    currentBombHolder = realPlayers[randomIndex]; 
                    io.to(currentBombHolder).emit('receiveBomb');
                }

                io.emit('timerUpdate', timeLeft);

                timerInterval = setInterval(() => {
                    timeLeft--;
                    io.emit('timerUpdate', timeLeft);

                    if (timeLeft <= 0) {
                        clearInterval(timerInterval);
                        isPlaying = false; 
                        io.emit('explode'); 
                        currentBombHolder = null; 
                    }
                }, 1000);
            }
        }, 1000);
    });

    socket.on('throwBomb', () => {
        if (!isPlaying) return; 
        if (socket.id !== currentBombHolder) return; 

        const now = Date.now();
        if (now - lastThrowTime < 300) return;
        lastThrowTime = now;

        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');
        
        if (realPlayers.length > 1) {
            const availableTargets = realPlayers.filter(id => id !== currentBombHolder);
            const randomIndex = Math.floor(Math.random() * availableTargets.length);
            currentBombHolder = availableTargets[randomIndex]; 
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

        if (isPlaying && wasBombHolder && timerInterval) { 
            const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');
            if (realPlayers.length > 0) {
                // ⭐ [변경됨] 폭탄을 든 사람이 도망갔을 때도 남은 사람 중 랜덤으로 할당!
                const randomIndex = Math.floor(Math.random() * realPlayers.length);
                currentBombHolder = realPlayers[randomIndex]; 
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
