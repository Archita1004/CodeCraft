
import "./InfoBox.css";
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import cloudy from "./WeatherImage/cloudy.jpg";
import clearsky from "./WeatherImage/clearsky.jpg";
import haze from "./WeatherImage/haze.jpg";
import rain from "./WeatherImage/rain.jpg";
import mist from "./WeatherImage/mist.jpg";
import elseImg from "./WeatherImage/else.jpg";

export default function InfoBox({info}) {

    const weather = info.description.toLowerCase();

    let IMG_URL = "";

    if (weather.includes("rain")) {
        IMG_URL = rain;
    } else if (weather.includes("cloud")) {
        IMG_URL = cloudy;
    } else if (weather.includes("clear")) {
        IMG_URL = clearsky;
    } else if (weather.includes("haze")) {
        IMG_URL = haze;
    } else if (weather.includes("mist")) {
        IMG_URL = mist;
    } else {
        IMG_URL = elseImg;
    }

    return (
        <div className="OuterContainer"> 
        
           <h1>Weather Information</h1>
           <div className="InfoBox">
            <Card sx={{ maxWidth: 345 }}>
                <CardActionArea>

                    <CardMedia
                        component="img"
                        height="140"
                        image={IMG_URL}
                        alt="Weather"
                    />

                    <CardContent>
                        <Typography gutterBottom variant="h5" component="div">
                            City: {info.city}
                        </Typography>

                        <div style={{ color: 'text.secondary' }}>
                            <p>Temperature: {info.temp}°C</p>
                            <p>Minimum Temperature: {info.tempMin}°C</p>
                            <p>Maximum Temperature: {info.tempMax}°C</p>
                            <p>Humidity: {info.humidity}%</p>
                            <p>Pressure: {info.pressure} hPa</p>
                            <p>Description: {info.description}</p>
                        </div>
                    </CardContent>

                </CardActionArea>
            </Card>
        </div>
        </div>
    );
}
