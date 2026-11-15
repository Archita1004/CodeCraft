
// import { useState } from "react";
// import { styled, alpha } from '@mui/material/styles';
// import AppBar from '@mui/material/AppBar';
// import Box from '@mui/material/Box';
// import Toolbar from '@mui/material/Toolbar';
// import IconButton from '@mui/material/IconButton';
// import Typography from '@mui/material/Typography';
// import InputBase from '@mui/material/InputBase';
// import Button from '@mui/material/Button';
// import MenuIcon from '@mui/icons-material/Menu';
// import SearchIcon from '@mui/icons-material/Search';

// const Search = styled('form')(({ theme }) => ({
//   position: 'relative',
//   borderRadius: theme.shape.borderRadius,
//   backgroundColor: alpha(theme.palette.common.white, 0.15),
//   '&:hover': {
//     backgroundColor: alpha(theme.palette.common.white, 0.25),
//   },
//   marginLeft: 0,
//   width: '100%',
//   display: 'flex',
//   alignItems: 'center',
//   [theme.breakpoints.up('sm')]: {
//     marginLeft: theme.spacing(1),
//     width: 'auto',
//   },
// }));

// const SearchIconWrapper = styled('div')(({ theme }) => ({
//   padding: theme.spacing(0, 2),
//   height: '100%',
//   position: 'absolute',
//   pointerEvents: 'none',
//   display: 'flex',
//   alignItems: 'center',
//   justifyContent: 'center',
// }));

// const StyledInputBase = styled(InputBase)(({ theme }) => ({
//   color: 'inherit',
//   width: '100%',
//   '& .MuiInputBase-input': {
//     padding: theme.spacing(1, 1, 1, 0),
//     paddingLeft: `calc(1em + ${theme.spacing(4)})`,
//     transition: theme.transitions.create('width'),
//     [theme.breakpoints.up('sm')]: {
//       width: '12ch',
//       '&:focus': {
//         width: '20ch',
//       },
//     },
//   },
// }));

// export default function NavBar() {

//   const [city, setCity] = useState("");

//   const API_URL = "https://api.openweathermap.org/data/2.5/weather";
//   const API_KEY = "YOUR_API_KEY";

//   let getWeatherInfo = async () => {
//     try {
//       let response = await fetch(
//         `${API_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
//       );

//       let jsonResponse = await response.json();

//       if (!response.ok) {
//         throw new Error(jsonResponse.message);
//       }

//       let answer = {
//         city: city,
//         temp: jsonResponse.main.temp,
//         tempMin: jsonResponse.main.temp_min,
//         tempMax: jsonResponse.main.temp_max,
//         humidity: jsonResponse.main.humidity,
//         pressure: jsonResponse.main.pressure,
//         description: jsonResponse.weather[0].description,
//       };

//       console.log(answer);

//     } catch (error) {
//       console.log(error.message);
//     }
//   };

//   let handleSubmit = (evt) => {
//     evt.preventDefault();
//     getWeatherInfo();
//     setCity("");
//   };

//   return (
//     <Box sx={{ flexGrow: 1 }}>
//       <AppBar position="static">
//         <Toolbar>

//           <IconButton
//             size="large"
//             edge="start"
//             color="inherit"
//             aria-label="open drawer"
//             sx={{ mr: 2 }}
//           >
//             <MenuIcon />
//           </IconButton>

//           <Typography
//             variant="h6"
//             noWrap
//             component="div"
//             sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}
//           >
//             Weather App
//           </Typography>

//           <Search onSubmit={handleSubmit}>
//             <SearchIconWrapper>
//               <SearchIcon />
//             </SearchIconWrapper>

//             <StyledInputBase
//               placeholder="Enter City"
//               inputProps={{ 'aria-label': 'search' }}
//               value={city}
//               onChange={(evt) => setCity(evt.target.value)}
//               required
//             />

//             <Button type="submit" color="inherit">
//               Search
//             </Button>

//           </Search>

//         </Toolbar>
//       </AppBar>
//     </Box>
//   );
// }
