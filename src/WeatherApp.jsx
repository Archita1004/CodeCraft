import "./index.css";
import "./WeatherApp.css";
import { useState } from "react";
import InfoBox from "./InfoBox";
import SearchBox from "./SearchBox";
export default function WeatherApp(){
    const [weatherInfo,setWeatherInfo]=useState({
        city: "Delhi",
        temp: 19.96,
        tempMin: 19.96,
        tempMax: 22.05,
        humidity: 94,
        pressure: 1015,
        description: "Mist"
    });
    let updateInfo =(newinfo) => {
        setWeatherInfo(newinfo);
    }
return(
        <div className="container">
        <SearchBox updateInfo={updateInfo}/>
        <InfoBox info={weatherInfo}/>
        </div>
)
}