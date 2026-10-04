import { Icon as SharedIcon, type IconProps as SharedIconProps } from '@lailai0916/ui';
import ArrowLeft from '@iconify-icons/lucide/arrow-left';
import ArrowRight from '@iconify-icons/lucide/arrow-right';
import Atom from '@iconify-icons/lucide/atom';
import BadgeCheck from '@iconify-icons/lucide/badge-check';
import Bell from '@iconify-icons/lucide/bell';
import BookOpen from '@iconify-icons/lucide/book-open';
import BookOpenCheck from '@iconify-icons/lucide/book-open-check';
import BookText from '@iconify-icons/lucide/book-text';
import Brain from '@iconify-icons/lucide/brain';
import CalendarClock from '@iconify-icons/lucide/calendar-clock';
import CalendarDays from '@iconify-icons/lucide/calendar-days';
import CalendarRange from '@iconify-icons/lucide/calendar-range';
import CalendarSync from '@iconify-icons/lucide/calendar-sync';
import ChartNoAxesColumn from '@iconify-icons/lucide/chart-no-axes-column';
import ChartNoAxesCombined from '@iconify-icons/lucide/chart-no-axes-combined';
import Check from '@iconify-icons/lucide/check';
import CheckCircle2 from '@iconify-icons/lucide/check-circle-2';
import ChevronDown from '@iconify-icons/lucide/chevron-down';
import ChevronRight from '@iconify-icons/lucide/chevron-right';
import CircleCheckBig from '@iconify-icons/lucide/circle-check-big';
import CircleHelp from '@iconify-icons/lucide/circle-help';
import CircleStop from '@iconify-icons/lucide/circle-stop';
import CircleX from '@iconify-icons/lucide/circle-x';
import CircuitBoard from '@iconify-icons/lucide/circuit-board';
import ClipboardCheck from '@iconify-icons/lucide/clipboard-check';
import Clock3 from '@iconify-icons/lucide/clock-3';
import CloudAlert from '@iconify-icons/lucide/cloud-alert';
import Feather from '@iconify-icons/lucide/feather';
import FlaskConical from '@iconify-icons/lucide/flask-conical';
import Globe2 from '@iconify-icons/lucide/globe-2';
import GraduationCap from '@iconify-icons/lucide/graduation-cap';
import Heart from '@iconify-icons/lucide/heart';
import History from '@iconify-icons/lucide/history';
import House from '@iconify-icons/lucide/house';
import Info from '@iconify-icons/lucide/info';
import Languages from '@iconify-icons/lucide/languages';
import Lightbulb from '@iconify-icons/lucide/lightbulb';
import ListChecks from '@iconify-icons/lucide/list-checks';
import Lock from '@iconify-icons/lucide/lock';
import LogOut from '@iconify-icons/lucide/log-out';
import Menu from '@iconify-icons/lucide/menu';
import MessagesSquare from '@iconify-icons/lucide/messages-square';
import Monitor from '@iconify-icons/lucide/monitor';
import NotebookTabs from '@iconify-icons/lucide/notebook-tabs';
import Pause from '@iconify-icons/lucide/pause';
import Play from '@iconify-icons/lucide/play';
import Plus from '@iconify-icons/lucide/plus';
import RotateCcw from '@iconify-icons/lucide/rotate-ccw';
import Route from '@iconify-icons/lucide/route';
import Save from '@iconify-icons/lucide/save';
import ScanSearch from '@iconify-icons/lucide/scan-search';
import Search from '@iconify-icons/lucide/search';
import Send from '@iconify-icons/lucide/send';
import Settings2 from '@iconify-icons/lucide/settings-2';
import ShieldCheck from '@iconify-icons/lucide/shield-check';
import Sigma from '@iconify-icons/lucide/sigma';
import Sparkles from '@iconify-icons/lucide/sparkles';
import Smartphone from '@iconify-icons/lucide/smartphone';
import Tablet from '@iconify-icons/lucide/tablet';
import Target from '@iconify-icons/lucide/target';
import UserRound from '@iconify-icons/lucide/user-round';
import UserCheck from '@iconify-icons/lucide/user-check';
import UserPlus from '@iconify-icons/lucide/user-plus';
import Users from '@iconify-icons/lucide/users';
import Upload from '@iconify-icons/lucide/upload';
import X from '@iconify-icons/lucide/x';

// Bundle the icon data so authenticated screens also work without Iconify requests.
const icons = {
  'lucide:arrow-left': ArrowLeft,
  'lucide:arrow-right': ArrowRight,
  'lucide:atom': Atom,
  'lucide:badge-check': BadgeCheck,
  'lucide:bell': Bell,
  'lucide:book-open': BookOpen,
  'lucide:book-open-check': BookOpenCheck,
  'lucide:book-text': BookText,
  'lucide:brain': Brain,
  'lucide:calendar-clock': CalendarClock,
  'lucide:calendar-days': CalendarDays,
  'lucide:calendar-range': CalendarRange,
  'lucide:calendar-sync': CalendarSync,
  'lucide:chart-no-axes-column': ChartNoAxesColumn,
  'lucide:chart-no-axes-combined': ChartNoAxesCombined,
  'lucide:check': Check,
  'lucide:check-circle-2': CheckCircle2,
  'lucide:chevron-down': ChevronDown,
  'lucide:chevron-right': ChevronRight,
  'lucide:circle-check-big': CircleCheckBig,
  'lucide:circle-help': CircleHelp,
  'lucide:circle-stop': CircleStop,
  'lucide:circle-x': CircleX,
  'lucide:circuit-board': CircuitBoard,
  'lucide:clipboard-check': ClipboardCheck,
  'lucide:clock-3': Clock3,
  'lucide:cloud-alert': CloudAlert,
  'lucide:feather': Feather,
  'lucide:flask-conical': FlaskConical,
  'lucide:globe-2': Globe2,
  'lucide:graduation-cap': GraduationCap,
  'lucide:heart': Heart,
  'lucide:history': History,
  'lucide:house': House,
  'lucide:info': Info,
  'lucide:languages': Languages,
  'lucide:lightbulb': Lightbulb,
  'lucide:list-checks': ListChecks,
  'lucide:lock': Lock,
  'lucide:log-out': LogOut,
  'lucide:menu': Menu,
  'lucide:messages-square': MessagesSquare,
  'lucide:monitor': Monitor,
  'lucide:notebook-tabs': NotebookTabs,
  'lucide:pause': Pause,
  'lucide:play': Play,
  'lucide:plus': Plus,
  'lucide:rotate-ccw': RotateCcw,
  'lucide:route': Route,
  'lucide:save': Save,
  'lucide:scan-search': ScanSearch,
  'lucide:search': Search,
  'lucide:send': Send,
  'lucide:settings-2': Settings2,
  'lucide:shield-check': ShieldCheck,
  'lucide:sigma': Sigma,
  'lucide:sparkles': Sparkles,
  'lucide:smartphone': Smartphone,
  'lucide:tablet': Tablet,
  'lucide:target': Target,
  'lucide:user-round': UserRound,
  'lucide:user-check': UserCheck,
  'lucide:user-plus': UserPlus,
  'lucide:users': Users,
  'lucide:upload': Upload,
  'lucide:x': X,
};

export type IconName = keyof typeof icons;
type IconProps = Omit<SharedIconProps, 'icon'> & { icon: IconName };
export function Icon({ icon, ...props }: IconProps) {
  return <SharedIcon aria-hidden="true" width="1em" icon={icons[icon]} {...props} />;
}
