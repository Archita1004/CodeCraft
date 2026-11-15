
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import "./SearchBox.css";
import { useState } from "react";

export default function SearchBox({updateInfo}) {

  let [city, setCity] = useState("");
  let [error, setError] = useState(false);

  const API_URL = "https://api.openweathermap.org/data/2.5/weather";
  const API_KEY = "fca345fcd88cfed72a75b619affe73dd";

  let getWeatherInfo = async () => {
    try {
      let response = await fetch(
        `${API_URL}?q=${city}&appid=${API_KEY}&units=metric`
      );

      if (!response.ok) {
        throw new Error("City not found");
      }

      let jsonResponse = await response.json();

      let answer = {
        city: city,
        temp: jsonResponse.main.temp,
        tempMin: jsonResponse.main.temp_min,
        tempMax: jsonResponse.main.temp_max,
        humidity: jsonResponse.main.humidity,
        pressure: jsonResponse.main.pressure,
        description: jsonResponse.weather[0].description,
      };

      console.log(answer);
      return answer;

    } catch(error) {
      throw error;
    }
  };

  let handleChange = (evt) => {
    setCity(evt.target.value);
  };

  let handleSubmit = async (evt) => {
    evt.preventDefault();

    try {
      let newinfo = await getWeatherInfo();
      updateInfo(newinfo);
      setError(false);
      setCity("");

    } catch(error) {
      setError(true);
    }
  };

  return (
    <div className="searchBox">
      <form onSubmit={handleSubmit}>
        <TextField
          id="city"
          label="Enter City"
          variant="filled"
          required
          value={city}
          onChange={handleChange}
        />
        <Button variant="contained" type="submit">
          Search
        </Button>

        {error && <p style={{ color: 'red' }}>No such place found.</p>}
      </form>
    </div>
  );
}


