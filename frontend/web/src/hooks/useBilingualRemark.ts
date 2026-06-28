import { useCallback, useMemo, useState } from 'react';
import {
  EMPTY_BILINGUAL,
  parseBilingualText,
  serializeBilingualText,
  type BilingualText,
} from '../utils/bilingualText';

export function useBilingualRemark(initial = '') {
  const [value, setValue] = useState<BilingualText>(() => parseBilingualText(initial));

  const serialized = useMemo(() => serializeBilingualText(value), [value]);

  const reset = useCallback((next = '') => {
    setValue(parseBilingualText(next));
  }, []);

  return { value, setValue, serialized, reset };
}

export { EMPTY_BILINGUAL };
