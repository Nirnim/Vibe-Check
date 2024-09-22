import React from 'react';
import { CssBaseline, Container } from '@mui/material';
import EmotionMusicRecommender from './EmotionMusicRecommender';

function App() {
  return (
    <>
      <CssBaseline />
      <Container>
        <EmotionMusicRecommender />
      </Container>
    </>
  );
}

export default App;