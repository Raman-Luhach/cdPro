/* =====================================================================
 * MetroLang — Delhi Metro network data
 * ---------------------------------------------------------------------
 * Station order and interchanges taken from the Wikipedia articles of
 * each line (Yellow, Blue, Violet, Magenta, Red, Pink), Nov 2026.
 * Coordinates are approximate (lon, lat) and only used to draw the
 * schematic map. Stations without a coordinate are interpolated along
 * their line.
 *
 * Modelling notes (kept simple on purpose):
 *  - Blue Line has a main route (Dwarka Sector 21 – Noida Electronic City)
 *    and a branch route (Dwarka Sector 21 – Vaishali) splitting at Yamuna Bank.
 *  - Pink Line is modelled as Majlis Park – Shiv Vihar (its 2026 ring-closing
 *    section is not modelled).
 *  - Magenta Line is modelled as Krishna Park Extension – Botanical Garden.
 *  - Only interchanges between these 6 lines are modelled.
 *
 * Exposed as a global (not JSON) so index.html works from file://
 * ===================================================================== */
(function (root) {
  'use strict';

  var LINES = [
    {
      id: 'yellow', name: 'Yellow', colour: '#F2B705', lengthKm: 49.02,
      routes: [[
        'Samaypur Badli', 'Rohini Sector 18, 19', 'Haiderpur Badli Mor', 'Jahangirpuri',
        'Adarsh Nagar', 'Azadpur', 'Model Town', 'Guru Tegh Bahadur Nagar', 'Vishwavidyalaya',
        'Vidhan Sabha', 'Civil Lines', 'Kashmere Gate', 'Chandni Chowk', 'Chawri Bazar',
        'New Delhi', 'Rajiv Chowk', 'Patel Chowk', 'Central Secretariat', 'Seva Teerth',
        'Lok Kalyan Marg', 'Jor Bagh', 'Dilli Haat - INA', 'AIIMS', 'Green Park', 'Hauz Khas',
        'Malviya Nagar', 'Saket', 'Qutab Minar', 'Chhatarpur', 'Sultanpur', 'Ghitorni',
        'Arjan Garh', 'Guru Dronacharya', 'Sikanderpur', 'MG Road', 'IFFCO Chowk',
        'Millennium City Centre Gurugram'
      ]]
    },
    {
      id: 'blue', name: 'Blue', colour: '#1F6FD1', lengthKm: 64.62,
      routeNames: ['Main line (Dwarka Sector 21 – Noida Electronic City)', 'Branch (Dwarka Sector 21 – Vaishali)'],
      hopKm: [56.11 / 49, 8.51 / 7],
      routes: [
        [
          'Dwarka Sector 21', 'Dwarka Sector 8', 'Dwarka Sector 9', 'Dwarka Sector 10',
          'Dwarka Sector 11', 'Dwarka Sector 12', 'Dwarka Sector 13', 'Dwarka Sector 14',
          'Dwarka-Kakrola', 'Dwarka Mor', 'Nawada', 'Uttam Nagar West', 'Uttam Nagar East',
          'Janakpuri West', 'Janakpuri East', 'Tilak Nagar', 'Subhash Nagar', 'Tagore Garden',
          'Rajouri Garden', 'Ramesh Nagar', 'Moti Nagar', 'Kirti Nagar', 'Shadipur',
          'Patel Nagar', 'Rajendra Place', 'Karol Bagh', 'Jhandewalan', 'Ramakrishna Ashram Marg',
          'Rajiv Chowk', 'Barakhamba Road', 'Mandi House', 'Supreme Court', 'Indraprastha',
          'Yamuna Bank', 'Akshardham', 'Mayur Vihar-I', 'Mayur Vihar Extension', 'New Ashok Nagar',
          'Noida Sector 15', 'Noida Sector 16', 'Noida Sector 18', 'Botanical Garden',
          'Golf Course', 'Noida City Centre', 'Noida Sector 34', 'Noida Sector 52',
          'Noida Sector 61', 'Noida Sector 59', 'Noida Sector 62', 'Noida Electronic City'
        ],
        // Branch: shares Dwarka Sector 21 .. Yamuna Bank with the main line
        ['@main..Yamuna Bank', 'Laxmi Nagar', 'Nirman Vihar', 'Preet Vihar', 'Karkarduma',
          'Anand Vihar', 'Kaushambi', 'Vaishali']
      ]
    },
    {
      id: 'violet', name: 'Violet', colour: '#7B3FA0', lengthKm: 46.34,
      routes: [[
        'Kashmere Gate', 'Lal Qila', 'Jama Masjid', 'Delhi Gate', 'ITO', 'Mandi House',
        'Janpath', 'Central Secretariat', 'Khan Market', 'Jawaharlal Nehru Stadium', 'Jangpura',
        'Lajpat Nagar', 'Moolchand', 'Kailash Colony', 'Nehru Place', 'Kalkaji Mandir',
        'Govindpuri', 'Harkesh Nagar Okhla', 'Jasola Apollo', 'Sarita Vihar', 'Mohan Estate',
        'Tughlakabad Station', 'Badarpur Border', 'Sarai', 'NHPC Chowk', 'Mewla Maharajpur',
        'Sector 28', 'Badkal Mor', 'Old Faridabad', 'Neelam Chowk Ajronda', 'Bata Chowk',
        'Escorts Mujesar', 'Sant Surdas - Sihi', 'Raja Nahar Singh'
      ]]
    },
    {
      id: 'magenta', name: 'Magenta', colour: '#C2187A', lengthKm: 40.26,
      routes: [[
        'Krishna Park Extension', 'Janakpuri West', 'Dabri Mor - Janakpuri South', 'Dashrathpuri',
        'Palam', 'Sadar Bazar Cantonment', 'Terminal 1-IGI Airport', 'Shankar Vihar',
        'Vasant Vihar', 'Munirka', 'R. K. Puram', 'IIT', 'Hauz Khas', 'Panchsheel Park',
        'Chirag Delhi', 'Greater Kailash', 'Nehru Enclave', 'Kalkaji Mandir', 'Okhla NSIC',
        'Sukhdev Vihar', 'Jamia Millia Islamia', 'Okhla Vihar', 'Jasola Vihar Shaheen Bagh',
        'Kalindi Kunj', 'Okhla Bird Sanctuary', 'Botanical Garden'
      ]]
    },
    {
      id: 'red', name: 'Red', colour: '#E03131', lengthKm: 34.55,
      routes: [[
        'Rithala', 'Dr. Baba Saheb Ambedkar Hospital', 'Rohini', 'Madhuban Chowk', 'Kohat Enclave',
        'Netaji Subhash Place', 'Keshav Puram', 'Kanhaiya Nagar', 'Inderlok', 'Shastri Nagar',
        'Pratap Nagar', 'Pulbangash', 'Tis Hazari', 'Kashmere Gate', 'Shastri Park', 'Seelampur',
        'Welcome', 'Shahdara', 'Mansarovar Park', 'Jhilmil', 'Dilshad Garden', 'Shaheed Nagar',
        'Raj Bagh', 'Major Mohit Sharma Rajendra Nagar', 'Shyam Park', 'Mohan Nagar', 'Arthala',
        'Hindon River', 'Shaheed Sthal (New Bus Adda)'
      ]]
    },
    {
      id: 'pink', name: 'Pink', colour: '#E8619E', lengthKm: 59.24,
      routes: [[
        'Majlis Park', 'Azadpur', 'Shalimar Bagh', 'Netaji Subhash Place', 'Shakurpur',
        'Punjabi Bagh West', 'ESI - Basaidarapur', 'Rajouri Garden', 'Mayapuri', 'Naraina Vihar',
        'Delhi Cantt.', 'Durgabai Deshmukh South Campus', 'Sir M. Vishweshwaraiah Moti Bagh',
        'Bhikaji Cama Place', 'Sarojini Nagar', 'Dilli Haat - INA', 'South Extension',
        'Lajpat Nagar', 'Vinobapuri', 'Ashram', 'Sarai Kale Khan - Nizamuddin', 'Mayur Vihar-I',
        'Shree Ram Mandir Mayur Vihar', 'Trilokpuri - Sanjay Lake', 'East Vinod Nagar - Mayur Vihar II',
        'Mandawali - West Vinod Nagar', 'IP Extension', 'Anand Vihar', 'Karkarduma',
        'Karkarduma Court', 'Krishna Nagar', 'East Azad Nagar', 'Welcome', 'Jaffrabad',
        'Maujpur - Babarpur', 'Gokulpuri', 'Johri Enclave', 'Shiv Vihar'
      ]]
    }
  ];

  // Short / common names people actually type -> official name
  var ALIASES = {
    'INA': 'Dilli Haat - INA',
    'Dilli Haat INA': 'Dilli Haat - INA',
    'Millennium City Centre': 'Millennium City Centre Gurugram',
    'HUDA City Centre': 'Millennium City Centre Gurugram',
    'Shaheed Sthal': 'Shaheed Sthal (New Bus Adda)',
    'New Bus Adda': 'Shaheed Sthal (New Bus Adda)',
    'Red Fort': 'Lal Qila',
    'Dwarka': 'Dwarka-Kakrola',
    'Rohini West': 'Dr. Baba Saheb Ambedkar Hospital',
    'Pitampura': 'Madhuban Chowk',
    'Rohini East': 'Rohini',
    'Mayur Vihar Phase 1': 'Mayur Vihar-I',
    'Mayur Vihar 1': 'Mayur Vihar-I',
    'Nizamuddin': 'Sarai Kale Khan - Nizamuddin',
    'Hazrat Nizamuddin': 'Sarai Kale Khan - Nizamuddin',
    'Ballabhgarh': 'Raja Nahar Singh',
    'Airport T1': 'Terminal 1-IGI Airport',
    'IGI Airport': 'Terminal 1-IGI Airport',
    'JLN Stadium': 'Jawaharlal Nehru Stadium',
    'Maujpur': 'Maujpur - Babarpur',
    'Dabri Mor': 'Dabri Mor - Janakpuri South',
    'Trilokpuri': 'Trilokpuri - Sanjay Lake',
    'Delhi Cantt': 'Delhi Cantt.',
    'South Campus': 'Durgabai Deshmukh South Campus',
    'Moti Bagh': 'Sir M. Vishweshwaraiah Moti Bagh',
    'Race Course': 'Lok Kalyan Marg',
    'GTB Nagar': 'Guru Tegh Bahadur Nagar',
    'RK Puram': 'R. K. Puram',
    'Jamia': 'Jamia Millia Islamia',
    'Shaheen Bagh': 'Jasola Vihar Shaheen Bagh',
    'Sihi': 'Sant Surdas - Sihi',
    'Basaidarapur': 'ESI - Basaidarapur',
    'Mohit Sharma Rajendra Nagar': 'Major Mohit Sharma Rajendra Nagar'
  };

  // Approximate [lon, lat] — used only for the schematic map.
  var COORDS = {
    // Yellow
    'Samaypur Badli': [77.1385, 28.7446], 'Haiderpur Badli Mor': [77.1494, 28.7215],
    'Jahangirpuri': [77.1626, 28.7259], 'Adarsh Nagar': [77.1705, 28.7165],
    'Azadpur': [77.1804, 28.7074], 'Model Town': [77.1938, 28.7025],
    'Vishwavidyalaya': [77.2148, 28.6950], 'Civil Lines': [77.2250, 28.6770],
    'Kashmere Gate': [77.2283, 28.6675], 'Chandni Chowk': [77.2301, 28.6579],
    'New Delhi': [77.2219, 28.6431], 'Rajiv Chowk': [77.2195, 28.6328],
    'Central Secretariat': [77.2121, 28.6147], 'Lok Kalyan Marg': [77.2109, 28.5970],
    'Dilli Haat - INA': [77.2094, 28.5753], 'AIIMS': [77.2077, 28.5683],
    'Green Park': [77.2073, 28.5598], 'Hauz Khas': [77.2066, 28.5434],
    'Saket': [77.2014, 28.5207], 'Qutab Minar': [77.1863, 28.5127],
    'Chhatarpur': [77.1752, 28.5068], 'Ghitorni': [77.1490, 28.4936],
    'Guru Dronacharya': [77.1025, 28.4820], 'Sikanderpur': [77.0930, 28.4813],
    'MG Road': [77.0801, 28.4795], 'IFFCO Chowk': [77.0721, 28.4723],
    'Millennium City Centre Gurugram': [77.0715, 28.4570],
    // Blue
    'Dwarka Sector 21': [77.0587, 28.5523], 'Dwarka Sector 8': [77.0705, 28.5657],
    'Dwarka Sector 9': [77.0647, 28.5745], 'Dwarka Sector 12': [77.0410, 28.5922],
    'Dwarka Sector 14': [77.0255, 28.6022], 'Dwarka-Kakrola': [77.0215, 28.6125],
    'Dwarka Mor': [77.0329, 28.6192], 'Uttam Nagar East': [77.0640, 28.6250],
    'Janakpuri West': [77.0780, 28.6293], 'Tilak Nagar': [77.0964, 28.6367],
    'Rajouri Garden': [77.1227, 28.6490], 'Kirti Nagar': [77.1508, 28.6555],
    'Shadipur': [77.1584, 28.6516], 'Patel Nagar': [77.1696, 28.6449],
    'Karol Bagh': [77.1901, 28.6440], 'Jhandewalan': [77.2002, 28.6443],
    'Ramakrishna Ashram Marg': [77.2084, 28.6392], 'Barakhamba Road': [77.2286, 28.6297],
    'Mandi House': [77.2346, 28.6258], 'Supreme Court': [77.2431, 28.6236],
    'Indraprastha': [77.2504, 28.6204], 'Yamuna Bank': [77.2679, 28.6232],
    'Akshardham': [77.2795, 28.6183], 'Mayur Vihar-I': [77.2895, 28.6044],
    'Mayur Vihar Extension': [77.2946, 28.5944], 'New Ashok Nagar': [77.3020, 28.5895],
    'Noida Sector 15': [77.3110, 28.5848], 'Noida Sector 18': [77.3260, 28.5706],
    'Botanical Garden': [77.3343, 28.5641], 'Golf Course': [77.3460, 28.5675],
    'Noida City Centre': [77.3570, 28.5747], 'Noida Sector 52': [77.3647, 28.5862],
    'Noida Sector 61': [77.3720, 28.5970], 'Noida Sector 59': [77.3730, 28.6070],
    'Noida Sector 62': [77.3790, 28.6180], 'Noida Electronic City': [77.3960, 28.6286],
    'Laxmi Nagar': [77.2773, 28.6304], 'Nirman Vihar': [77.2867, 28.6366],
    'Preet Vihar': [77.2950, 28.6418], 'Karkarduma': [77.3058, 28.6485],
    'Anand Vihar': [77.3159, 28.6469], 'Kaushambi': [77.3245, 28.6450],
    'Vaishali': [77.3400, 28.6499],
    // Violet
    'Lal Qila': [77.2386, 28.6567], 'Jama Masjid': [77.2377, 28.6505],
    'Delhi Gate': [77.2406, 28.6403], 'ITO': [77.2407, 28.6277],
    'Janpath': [77.2194, 28.6247], 'Khan Market': [77.2276, 28.6003],
    'Jawaharlal Nehru Stadium': [77.2343, 28.5902], 'Jangpura': [77.2406, 28.5848],
    'Lajpat Nagar': [77.2368, 28.5707], 'Moolchand': [77.2341, 28.5642],
    'Kailash Colony': [77.2420, 28.5555], 'Nehru Place': [77.2513, 28.5515],
    'Kalkaji Mandir': [77.2588, 28.5498], 'Govindpuri': [77.2640, 28.5444],
    'Jasola Apollo': [77.2834, 28.5384], 'Sarita Vihar': [77.2880, 28.5285],
    'Mohan Estate': [77.2955, 28.5180], 'Tughlakabad Station': [77.2995, 28.5025],
    'Badarpur Border': [77.3017, 28.4934], 'Sarai': [77.3073, 28.4778],
    'NHPC Chowk': [77.3040, 28.4620], 'Sector 28': [77.3070, 28.4380],
    'Old Faridabad': [77.3050, 28.4110], 'Bata Chowk': [77.3120, 28.3860],
    'Raja Nahar Singh': [77.3170, 28.3380],
    // Magenta
    'Krishna Park Extension': [77.0745, 28.6420], 'Dabri Mor - Janakpuri South': [77.0834, 28.6155],
    'Dashrathpuri': [77.0850, 28.6015], 'Palam': [77.0864, 28.5893],
    'Sadar Bazar Cantonment': [77.1000, 28.5760], 'Terminal 1-IGI Airport': [77.1214, 28.5645],
    'Shankar Vihar': [77.1390, 28.5600], 'Vasant Vihar': [77.1610, 28.5590],
    'Munirka': [77.1720, 28.5580], 'R. K. Puram': [77.1830, 28.5590],
    'IIT': [77.1960, 28.5490], 'Panchsheel Park': [77.2170, 28.5420],
    'Chirag Delhi': [77.2270, 28.5375], 'Greater Kailash': [77.2390, 28.5425],
    'Nehru Enclave': [77.2470, 28.5450], 'Okhla NSIC': [77.2665, 28.5545],
    'Sukhdev Vihar': [77.2750, 28.5580], 'Jamia Millia Islamia': [77.2825, 28.5610],
    'Okhla Vihar': [77.2900, 28.5560], 'Jasola Vihar Shaheen Bagh': [77.2965, 28.5460],
    'Kalindi Kunj': [77.3105, 28.5455], 'Okhla Bird Sanctuary': [77.3230, 28.5530],
    // Red
    'Rithala': [77.1053, 28.7208], 'Dr. Baba Saheb Ambedkar Hospital': [77.1153, 28.7150],
    'Rohini': [77.1250, 28.7080], 'Madhuban Chowk': [77.1320, 28.7035],
    'Kohat Enclave': [77.1407, 28.6983], 'Netaji Subhash Place': [77.1521, 28.6955],
    'Keshav Puram': [77.1615, 28.6890], 'Kanhaiya Nagar': [77.1648, 28.6823],
    'Inderlok': [77.1700, 28.6733], 'Shastri Nagar': [77.1817, 28.6700],
    'Pratap Nagar': [77.1983, 28.6667], 'Pulbangash': [77.2063, 28.6662],
    'Tis Hazari': [77.2165, 28.6670], 'Shastri Park': [77.2500, 28.6682],
    'Seelampur': [77.2667, 28.6700], 'Welcome': [77.2778, 28.6718],
    'Shahdara': [77.2896, 28.6735], 'Mansarovar Park': [77.3015, 28.6754],
    'Jhilmil': [77.3125, 28.6757], 'Dilshad Garden': [77.3210, 28.6758],
    'Shaheed Nagar': [77.3370, 28.6720], 'Raj Bagh': [77.3460, 28.6750],
    'Major Mohit Sharma Rajendra Nagar': [77.3570, 28.6770], 'Shyam Park': [77.3700, 28.6780],
    'Mohan Nagar': [77.3840, 28.6780], 'Arthala': [77.3940, 28.6760],
    'Hindon River': [77.4060, 28.6740], 'Shaheed Sthal (New Bus Adda)': [77.4210, 28.6700],
    // Pink
    'Majlis Park': [77.1800, 28.7250], 'Shalimar Bagh': [77.1640, 28.7020],
    'Shakurpur': [77.1500, 28.6860], 'Punjabi Bagh West': [77.1310, 28.6720],
    'ESI - Basaidarapur': [77.1270, 28.6610], 'Mayapuri': [77.1300, 28.6370],
    'Naraina Vihar': [77.1400, 28.6270], 'Delhi Cantt.': [77.1380, 28.6060],
    'Durgabai Deshmukh South Campus': [77.1620, 28.5890],
    'Sir M. Vishweshwaraiah Moti Bagh': [77.1770, 28.5790],
    'Bhikaji Cama Place': [77.1870, 28.5690], 'Sarojini Nagar': [77.1980, 28.5720],
    'South Extension': [77.2200, 28.5690], 'Vinobapuri': [77.2450, 28.5720],
    'Ashram': [77.2530, 28.5720], 'Sarai Kale Khan - Nizamuddin': [77.2580, 28.5890],
    'Shree Ram Mandir Mayur Vihar': [77.2960, 28.6040], 'Trilokpuri - Sanjay Lake': [77.3050, 28.6100],
    'East Vinod Nagar - Mayur Vihar II': [77.3080, 28.6180], 'Mandawali - West Vinod Nagar': [77.3060, 28.6245],
    'IP Extension': [77.3110, 28.6310], 'Karkarduma Court': [77.3010, 28.6560],
    'Krishna Nagar': [77.2900, 28.6580], 'East Azad Nagar': [77.2840, 28.6640],
    'Jaffrabad': [77.2730, 28.6830], 'Maujpur - Babarpur': [77.2780, 28.6920],
    'Gokulpuri': [77.2840, 28.7010], 'Johri Enclave': [77.2900, 28.7130],
    'Shiv Vihar': [77.2960, 28.7220]
  };

  // DMRC fare slabs (revised Aug 2025), by distance in km
  var FARE_SLABS = [
    { upto: 2, fare: 11 }, { upto: 5, fare: 21 }, { upto: 12, fare: 32 },
    { upto: 21, fare: 43 }, { upto: 32, fare: 54 }, { upto: Infinity, fare: 64 }
  ];

  // Time model (minutes) — a simple, explainable estimate
  var TIME_MODEL = {
    avgSpeedKmh: 36,      // average running speed incl. station stops
    interchangeMin: 5,    // walking between platforms + waiting
    entryMin: 2,          // security + platform at start
    exitMin: 1            // walking out at the end
  };

  root.METRO_DATA = {
    lines: LINES, aliases: ALIASES, coords: COORDS,
    fareSlabs: FARE_SLABS, timeModel: TIME_MODEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
