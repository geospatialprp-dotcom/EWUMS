import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { TableCell, TableHead, TableRow } from '@mui/material';
import { constructionHeaderCellSx, type ConstructionTableStage } from '../../utils/constructionTableStyles';

/** Drop-in replacement for TableHead + TableRow with themed header cells. */
export function ConstructionStyledTableHead({
  stage,
  children,
}: {
  stage: ConstructionTableStage;
  children: ReactNode;
}) {
  return (
    <TableHead>
      <TableRow>
        {Children.map(children, (child) => {
          if (!isValidElement(child)) return child;
          const cell = child as ReactElement<{ sx?: Record<string, unknown> }>;
          if (cell.type !== TableCell) return child;
          return cloneElement(cell, {
            sx: constructionHeaderCellSx(stage, cell.props.sx),
          });
        })}
      </TableRow>
    </TableHead>
  );
}

export default ConstructionStyledTableHead;

export { constructionTableShellSx, constructionSectionBarSx, constructionTableTheme } from '../../utils/constructionTableStyles';
