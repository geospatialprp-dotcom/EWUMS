import { TableCell, TableHead, TableRow } from '@mui/material';
import type { ConstructionTableStage } from '../../utils/constructionTableStyles';
import { constructionHeaderCellSx } from '../../utils/constructionTableStyles';

export type ConstructionTableColumn = {
  label: string;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
  sx?: Record<string, unknown>;
};

interface ConstructionTableHeadProps {
  stage: ConstructionTableStage;
  columns: ConstructionTableColumn[];
}

export default function ConstructionTableHead({ stage, columns }: ConstructionTableHeadProps) {
  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => (
          <TableCell
            key={column.label}
            align={column.align ?? 'left'}
            sx={constructionHeaderCellSx(stage, {
              ...(column.minWidth ? { minWidth: column.minWidth } : {}),
              ...column.sx,
            })}
          >
            {column.label}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}
