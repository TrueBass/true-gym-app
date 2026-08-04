import IconBarbell from '@tabler/icons-react-native/IconBarbell';
import IconBat from '@tabler/icons-react-native/IconBat';
import IconCrown from '@tabler/icons-react-native/IconCrown';
import IconDragon from '@tabler/icons-react-native/IconDragon';
import IconDumbbell from '@tabler/icons-react-native/IconDumbbell';
import IconFishBone from '@tabler/icons-react-native/IconFishBone';
import IconPig from '@tabler/icons-react-native/IconPig';
import IconSpider from '@tabler/icons-react-native/IconSpider';
import IconStretching from '@tabler/icons-react-native/IconStretching';

/**
 * The nine avatars, worst-to-best.
 *
 * Only `key` is ever stored — the icon is a rendering decision that lives here,
 * so replacing artwork never touches stored data or needs a migration. That is
 * why the keys read as ranks rather than as pictures.
 *
 * Levels 1 and 2 are both "never lifted", split by which direction they want to
 * go. They are named for the goal rather than the body: these are chosen by the
 * user, and the joke only lands if it's one they're in on.
 *
 * Every icon was rendered and checked before being listed. Tabler's Barbell is
 * drawn as a dumbbell and its Dumbbell as a kettlebell, which is why they sit
 * at those two rungs.
 */
export const AVATARS = [
  { key: 'here_to_gain', level: 1, Icon: IconFishBone, label: 'Skin & Bones', blurb: 'Never lifted. Here to gain.' },
  { key: 'here_to_lose', level: 2, Icon: IconPig, label: 'Off-Season', blurb: 'Never lifted. Here to lose.' },
  { key: 'warming_up', level: 3, Icon: IconStretching, label: 'Warming Up', blurb: 'Just started showing up' },
  { key: 'casual', level: 4, Icon: IconBarbell, label: 'Casual', blurb: 'Two sets and a smoothie' },
  { key: 'regular', level: 5, Icon: IconDumbbell, label: 'Regular', blurb: 'Actually has a routine' },
  { key: 'consistent', level: 6, Icon: IconSpider, label: 'Consistent', blurb: 'Never misses leg day' },
  { key: 'advanced', level: 7, Icon: IconDragon, label: 'Advanced', blurb: 'Knows what a deload is' },
  { key: 'batman', level: 8, Icon: IconBat, label: 'Batman', blurb: 'Trains at hours nobody sees' },
  { key: 'unit', level: 9, Icon: IconCrown, label: 'Certified Unit', blurb: 'Peak silhouette' },
];

export const findAvatar = (key) => AVATARS.find((a) => a.key === key) ?? null;
