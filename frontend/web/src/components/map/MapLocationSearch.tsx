import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  CircularProgress,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import { GeocodeResult, searchPlaces } from '../../utils/geocoding';
import { MAP_CHROME, mapSearchBarSx } from '../../utils/mapChromeStyles';
import { ARCMAP } from '../gis/arcMapUi';

interface MapLocationSearchProps {
  onSelect: (result: GeocodeResult) => void;
  placeholder?: string;
  /** Restrict search to WGS 84 bbox [west, south, east, north] */
  searchBbox?: [number, number, number, number];
  placement?: 'titleBar' | 'map';
}

export default function MapLocationSearch({
  onSelect,
  placeholder = 'Search village, town, or settlement…',
  searchBbox,
  placement = 'map',
}: MapLocationSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const debouncedQuery = useMemo(() => inputValue.trim(), [inputValue]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setOptions([]);
      setError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');

    const timer = window.setTimeout(() => {
      searchPlaces(debouncedQuery, controller.signal, searchBbox)
        .then((results) => {
          setOptions(results);
          if (!results.length) setError('No places found in your jurisdiction');
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setError(err instanceof Error ? err.message : 'Search failed');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [debouncedQuery, searchBbox]);

  return (
    <Paper elevation={0} sx={mapSearchBarSx(placement)}>
      <Autocomplete
        fullWidth
        freeSolo={false}
        options={options}
        loading={loading}
        filterOptions={(value) => value}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        noOptionsText={debouncedQuery.length < 2 ? 'Type a village, town, or scheme…' : error || 'No places found'}
        onChange={(_, value) => {
          if (value && typeof value !== 'string') {
            onSelect(value);
            setInputValue(value.label);
          }
        }}
        inputValue={inputValue}
        onInputChange={(_, value, reason) => {
          if (reason === 'reset') return;
          setInputValue(value);
        }}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          return (
            <Box component="li" key={key} {...optionProps} sx={{ alignItems: 'flex-start !important', py: 1.25 }}>
              <PlaceIcon fontSize="small" sx={{ mt: 0.3, mr: 1, color: MAP_CHROME.accent }} />
              <Box minWidth={0}>
                <Typography variant="body2" fontWeight={600} noWrap>{option.label}</Typography>
                {option.placeType ? (
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {option.placeType.replace(/_/g, ' ')}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
                fontSize: '0.8125rem',
                minHeight: 28,
                '& fieldset': { border: 'none' },
                bgcolor: '#ffffff',
              },
            }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: ARCMAP.accent }} />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={18} sx={{ color: MAP_CHROME.accent }} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </Paper>
  );
}
