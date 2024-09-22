import React, { useEffect, useState, useCallback } from 'react';
import { TextField, Button, Card, CardContent, Typography, CircularProgress, List, ListItem, ListItemText} from '@mui/material';
import SpotifyWebApi from 'spotify-web-api-node';
import { HfInference } from '@huggingface/inference';

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.REACT_APP_SPOTIFY_CLIENT_ID,
  clientSecret: process.env.REACT_APP_SPOTIFY_CLIENT_SECRET,
});

const EmotionMusicRecommender = () => {
  const [emotion, setEmotion] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState(null);

  // Peticion fetch para recibir token de login de Spotify
  const getSpotifyToken = useCallback(async () => {
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      headers: {
        'Authorization': 'Basic ' + btoa(`${process.env.REACT_APP_SPOTIFY_CLIENT_ID}:${process.env.REACT_APP_SPOTIFY_CLIENT_SECRET}`)
      },
      form: {
        grant_type: 'client_credentials'
      }
    };

    try {
      const response = await fetch(authOptions.url, {
        method: 'POST',
        headers: {
          'Authorization': authOptions.headers['Authorization'],
          'Content-type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`Error HTTP! estado: ${response.status}`);
      }

      const data = await response.json();
      const token = data.access_token;
      setSpotifyToken(token);
      spotifyApi.setAccessToken(token);
    } catch (error) {
      console.error('Error consiguiendo token de acceso para Spotify:', error);
    }
  }, []);

  useEffect(() => {
    getSpotifyToken();
  }, [getSpotifyToken]);
  
  // Peticion de recomendaciones de canciones
  const getSpotifyRecommendations = useCallback(async (sentiment) => {
    // Generos basados en el sentimiento que transmite nuestro prompt
    const seedGenres = sentiment === 'POSITIVE'
    ? ['happy','pop', 'dance', 'k-pop'] // Canciones felices
    : ['sad', 'acoustic', 'chill', 'rainy-day']; // Canciones tristes

    // Parametros de audioFeature basados en el sentimiento para unas recomendaciones mas precisas
    const audioFeatures = sentiment === 'POSITIVE'
      ? { min_valence: 0.7, min_energy: 0.7, max_mode:1} // Canciones felices
      : { max_valence: 0.3, max_energy: 0.4, min_mode:0}; // Canciones tristes
    
    // Peticion a la API de Spotify con todas las caracteristicas que hemos generado
    try{
      const response = await spotifyApi.getRecommendations({
        seed_genres: seedGenres,
        limit: 5,
        ...audioFeatures
      });

      if (!response.body || !response.body.tracks) {
        throw new Error ('Estructura de respuesta inesperada de la API de Spotify');
      }

      return response.body.tracks.map(track => ({
        name: track.name,
        artist: track.artists[0].name,
        url: track.external_urls.spotify,
      }));
    } catch (error) {
      console.error('Error al recibir las recomendaciones de Spotify:', error);
      return [];
    }
  }, []);

  // Analizar el sentimiento que transmite nuestro prompt
  const analyzeSentiment = useCallback(async (emotion) => {
    try {
      const hf = new HfInference(process.env.REACT_APP_HUGGING_FACE_API_KEY);
      // Peticion a la API de Hugging Face con nuestro prompt
      const result = await hf.textClassification({
        model: 'distilbert-base-uncased-finetuned-sst-2-english',
        inputs: emotion,
      });
      return result[0].label;
    } catch (error) {
      console.error('Error al analizar el sentimiento con HuggingFace:', error);
      return 'UNDEFINED';
    }
  }, []);

  // Cuando cambia el valor del prompt del usuario
  const handleEmotionChange = (event) => {
    setEmotion(event.target.value);
  };

  // Cuando se pulsa el boton de Recomendaciones
  const handleGetRecommendations = async() => {
    if (!spotifyToken) {
      console.error('Token de Spotify no disponible');
      return;
    }
    setLoading(true);
    setRecommendations([]);
    try {
      const sentiment = await analyzeSentiment(emotion);
      const spotifyRecommendations = await getSpotifyRecommendations(sentiment);
      setRecommendations(spotifyRecommendations);
    } catch (error) {
      console.error('Error al analizar sentimientos o al recibir recomendaciones:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="App">
        <Card>
          <CardContent>
            <Typography variant="h5" component="div" gutterBottom>
              Vibe check!
            </Typography>
            <TextField
              fullWidth
              label="How do you feel?"
              variant="outlined"
              value={emotion}
              onChange={handleEmotionChange}
              margin="normal"
            />
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleGetRecommendations} 
              sx={{ marginTop: 2, marginBottom: 2 }}
              disabled={loading || !emotion.trim() || !spotifyToken}
            >
              Get Recommendations!
            </Button>
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <CircularProgress />
              </div>
            )}
            {!loading && recommendations.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <Typography variant="h6">Recommended songs:</Typography>
                <List>
                  {recommendations.map((song, index) => (
                    <ListItem key={index} component="a" href={song.url} target="_blank" rel="noopener noreferrer">
                      <ListItemText primary={song.name} secondary={song.artist} />
                    </ListItem>
                  ))}
                </List>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default EmotionMusicRecommender;