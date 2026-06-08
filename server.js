const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = []; // 접속한 모든 기기의 socket.id
let playerNames = {}; // 각 기기의 닉네임 저장소
let hasBombIndex = 0;
let timerInterval = null;

io.on('connection', (socket) => {
    players.push(socket.id);
    playerNames[socket.id] = "대기중...";

    // 1. 플레이어가 스마트폰에서 닉네임을 입력했을 때
    socket.on('setNickname', (nickname) => {
        playerNames[socket.id] = nickname;
        broadcastPlayerList();
    });

    // 2. 전광판이 접속했을 때 (닉네임을 'DISPLAY'로 지정해 플레이어와 구분)
    socket.on('registerDisplay', () => {
        playerNames[socket.id] = 'DISPLAY';
        broadcastPlayerList();
    });

    // 전체 전광판에 현재 접속한 플레이어 닉네임 명단 쏘기
    function broadcastPlayerList() {
        // 'DISPLAY'가 아닌 진짜 플레이어들의 닉네임만 모아서 배열로 만듦
        const list = players.map(id => playerNames[id]).filter(name => name !== 'DISPLAY' && name !== '대기중...');
        io.emit('updatePlayerList', list);
    }

    // 전광판에서 '게임 시작' 버튼을 눌렀을 때
    socket.on('startGame', () => {
        if (Object.keys(players).length === 0) return;
        let timeLeft = 30; // 30초 타이머
        
        // 폭탄을 돌릴 진짜 플레이어들만 추려냄
        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');

        // 플레이어가 1명 이상일 때 첫 번째 사람에게 폭탄 지급
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
                io.emit('explode'); // 폭탄 폭발!
            }
        }, 1000);
    });

    // 누군가 폭탄을 오른쪽으로 던졌을 때
    socket.on('throwBomb', () => {
        const realPlayers = players.filter(id => playerNames[id] !== 'DISPLAY' && playerNames[id] !== '대기중...');
        if (realPlayers.length > 0) {
            // 다음 사람 계산
            hasBombIndex = (hasBombIndex + 1) % realPlayers.length;
            io.to(realPlayers[hasBombIndex]).emit('receiveBomb');
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(id => id !== socket.id);
        delete playerNames[socket.id];
        broadcastPlayerList(); // 누군가 나가면 명단 새로고침
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
