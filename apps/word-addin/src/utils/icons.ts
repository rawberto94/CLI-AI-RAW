/**
 * FluentUI icon re-exports with React 19 JSX-compatible types.
 *
 * @fluentui/react-icons defines FluentIcon as FunctionComponent which
 * returns ReactNode | Promise<ReactNode>. React 19 narrowed ReactNode
 * to exclude Promise & bigint, breaking all <IconName /> JSX usage.
 *
 * This module re-exports every icon used across the add-in with a
 * corrected FC type so JSX works without per-usage casts.
 */

import * as React from 'react';
import type { FluentIcon, FluentIconsProps } from '@fluentui/react-icons';
import {
  AddRegular as _AddRegular,
  ArrowDownloadRegular as _ArrowDownloadRegular,
  ArrowSwapRegular as _ArrowSwapRegular,
  ArrowSyncRegular as _ArrowSyncRegular,
  BuildingRegular as _BuildingRegular,
  CalendarRegular as _CalendarRegular,
  CheckmarkCircleRegular as _CheckmarkCircleRegular,
  ColorRegular as _ColorRegular,
  CopyRegular as _CopyRegular,
  DeleteRegular as _DeleteRegular,
  DocumentCopyRegular as _DocumentCopyRegular,
  DocumentRegular as _DocumentRegular,
  DocumentTextRegular as _DocumentTextRegular,
  EditRegular as _EditRegular,
  ErrorCircleRegular as _ErrorCircleRegular,
  FolderRegular as _FolderRegular,
  InfoRegular as _InfoRegular,
  KeyRegular as _KeyRegular,
  LightbulbRegular as _LightbulbRegular,
  LockClosedRegular as _LockClosedRegular,
  MoneyRegular as _MoneyRegular,
  MoreHorizontalRegular as _MoreHorizontalRegular,
  NoteRegular as _NoteRegular,
  PersonRegular as _PersonRegular,
  SaveRegular as _SaveRegular,
  SearchRegular as _SearchRegular,
  SettingsRegular as _SettingsRegular,
  ShieldCheckmarkRegular as _ShieldCheckmarkRegular,
  SignOutRegular as _SignOutRegular,
  SparkleRegular as _SparkleRegular,
  TextBulletListSquareRegular as _TextBulletListSquareRegular,
  TextGrammarArrowLeftRegular as _TextGrammarArrowLeftRegular,
  WarningRegular as _WarningRegular,
} from '@fluentui/react-icons';

/** React 19-compatible icon component type */
type IconComponent = React.FC<Partial<FluentIconsProps> & { fontSize?: string | number }>;

/** Cast a FluentIcon to a React 19-compatible FC */
const ic = (icon: FluentIcon): IconComponent => icon as unknown as IconComponent;

export const AddRegular = ic(_AddRegular);
export const ArrowDownloadRegular = ic(_ArrowDownloadRegular);
export const ArrowSwapRegular = ic(_ArrowSwapRegular);
export const ArrowSyncRegular = ic(_ArrowSyncRegular);
export const BuildingRegular = ic(_BuildingRegular);
export const CalendarRegular = ic(_CalendarRegular);
export const CheckmarkCircleRegular = ic(_CheckmarkCircleRegular);
export const ColorRegular = ic(_ColorRegular);
export const CopyRegular = ic(_CopyRegular);
export const DeleteRegular = ic(_DeleteRegular);
export const DocumentCopyRegular = ic(_DocumentCopyRegular);
export const DocumentRegular = ic(_DocumentRegular);
export const DocumentTextRegular = ic(_DocumentTextRegular);
export const EditRegular = ic(_EditRegular);
export const ErrorCircleRegular = ic(_ErrorCircleRegular);
export const FolderRegular = ic(_FolderRegular);
export const InfoRegular = ic(_InfoRegular);
export const KeyRegular = ic(_KeyRegular);
export const LightbulbRegular = ic(_LightbulbRegular);
export const LockClosedRegular = ic(_LockClosedRegular);
export const MoneyRegular = ic(_MoneyRegular);
export const MoreHorizontalRegular = ic(_MoreHorizontalRegular);
export const NoteRegular = ic(_NoteRegular);
export const PersonRegular = ic(_PersonRegular);
export const SaveRegular = ic(_SaveRegular);
export const SearchRegular = ic(_SearchRegular);
export const SettingsRegular = ic(_SettingsRegular);
export const ShieldCheckmarkRegular = ic(_ShieldCheckmarkRegular);
export const SignOutRegular = ic(_SignOutRegular);
export const SparkleRegular = ic(_SparkleRegular);
export const TextBulletListSquareRegular = ic(_TextBulletListSquareRegular);
export const TextGrammarArrowLeftRegular = ic(_TextGrammarArrowLeftRegular);
export const WarningRegular = ic(_WarningRegular);
