import React from 'react';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { Box, Chip } from '@mui/material';
import SignalWifiStatusbar4BarIcon from '@mui/icons-material/SignalWifiStatusbar4Bar';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';

export const ConnectionStatus: React.FC = () => {
  const { isConnected } = useWebSocket();

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
      <Chip
        icon={isConnected ? <SignalWifiStatusbar4BarIcon /> : <SignalWifiOffIcon />}
        label={isConnected ? 'Connected' : 'Disconnected'}
        color={isConnected ? 'success' : 'error'}
        variant="outlined"
      />
    </Box>
  );
}; 