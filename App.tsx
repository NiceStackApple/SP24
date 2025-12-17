
import React from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { Phase, ActionType } from './types';

const App: React.FC = () => {
  const { 
    state, 
    startGame, 
    submitAction, 
    useItem,
    leaveGame,
    surrenderGame,
    claimVictory,
    pendingAction,
    sendChatMessage,
    closeModal
  } = useGameEngine();

  const handleActionSelect = (type: ActionType, targetId?: string) => {
    submitAction(type, targetId || null);
  };

  if (state.phase === Phase.LOBBY) {
    return <Lobby onStart={startGame} />;
  }

  return (
    <GameBoard 
      state={state} 
      pendingAction={pendingAction} 
      onActionSelect={handleActionSelect}
      onSendMessage={sendChatMessage}
      onEquipItem={useItem}
      onLeaveGame={leaveGame}
      onSurrender={surrenderGame}
      onCloseModal={closeModal}
      onClaimVictory={claimVictory}
    />
  );
};

export default App;
