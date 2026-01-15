/**
 * Word Frequency Module for Adaptive Speed Reading
 * 
 * This module provides word frequency data for multiple languages.
 * Common words can be read faster, while rare/complex words need more time.
 * 
 * Supports:
 * - English: Based on combined corpora data (COCA, BNC, Google Books)
 * - Norwegian: Based on Norwegian frequency lists (NoWaC, Norwegian Web Corpus)
 * 
 * Lower rank = more common (rank 1 = "the" / "og")
 */

import { type SupportedLanguage, detectLanguage } from './syllables';

// ============================================================================
// ENGLISH WORD FREQUENCY DATA
// ============================================================================

// Top 150 - extremely common, can be read very fast (rank 1-150)
const EN_TIER_1_WORDS = new Set([
  // Function words and most common vocabulary
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  // Additional very common words (rank 101-150)
  'very', 'had', 'has', 'been', 'were', 'was', 'are', 'is', 'did',
  'am', 'being', 'more', 'those', 'such', 'own', 'through', 'same', 'down', 'should',
  'each', 'much', 'before', 'must', 'may', 'right', 'too', 'does', 'off', 'put',
  'old', 'while', 'here', 'where', 'why', 'let', 'still', 'thing', 'every', 'went',
  'made', 'find', 'long', 'little', 'great', 'man', 'world', 'life',
]);

// Tier 2: Very common words (rank 151-600)
const EN_TIER_2_WORDS = new Set([
  // Common verbs
  'need', 'feel', 'seem', 'leave', 'call', 'keep', 'begin', 'start', 'help', 'show',
  'hear', 'play', 'run', 'move', 'live', 'believe', 'hold', 'bring', 'happen', 'write',
  'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue', 'set', 'learn', 'change',
  'lead', 'understand', 'watch', 'follow', 'stop', 'create', 'speak', 'read', 'allow',
  'add', 'spend', 'grow', 'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider',
  'appear', 'buy', 'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall',
  'cut', 'reach', 'kill', 'remain', 'suggest', 'raise', 'pass', 'sell', 'require', 'report',
  'decide', 'pull', 'develop', 'tell', 'ask', 'try', 'turn', 'mean', 'become',
  
  // Common nouns
  'night', 'hand', 'part', 'child', 'eye', 'woman', 'place',
  'case', 'week', 'company', 'system', 'program', 'question', 'during', 'government', 'number', 'home',
  'water', 'room', 'mother', 'area', 'money', 'story', 'fact', 'month', 'lot', 'study',
  'book', 'job', 'word', 'business', 'issue', 'side', 'kind', 'head', 'house', 'service',
  'friend', 'father', 'power', 'hour', 'game', 'line', 'end', 'member', 'law', 'car',
  'city', 'community', 'name', 'president', 'team', 'minute', 'idea', 'kid', 'body', 'information',
  'school', 'face', 'others', 'family', 'group', 'problem', 'party', 'point', 'percent', 'office',
  
  // Common adjectives
  'different', 'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad',
  'same', 'able', 'free', 'sure', 'real', 'best', 'better', 'last', 'big',
  'high', 'low', 'full', 'special', 'easy', 'clear', 'recent', 'certain', 'personal',
  'red', 'hard', 'white', 'black', 'whole', 'true', 'possible', 'political', 'social', 'national',
  'local', 'late', 'general', 'major', 'strong', 'human', 'international', 'economic', 'short', 'least',
  
  // Common adverbs
  'never', 'always', 'often', 'really', 'quite', 'probably', 'already', 'perhaps', 'actually',
  'simply', 'almost', 'especially', 'together', 'likely', 'sometimes', 'away', 'again', 'ever',
  'once', 'rather', 'usually', 'certainly', 'quickly', 'finally', 'nearly', 'clearly', 'particularly',
  
  // More common words
  'although', 'against', 'among', 'however', 'without', 'between', 'enough', 'behind', 'far', 'yet',
  'across', 'within', 'toward', 'whether', 'around', 'until', 'along', 'upon', 'since', 'ago',
  'according', 'nothing', 'anything', 'everything', 'something', 'someone', 'anyone', 'everyone', 'nobody',
  'country', 'state', 'history', 'process', 'result', 'reason', 'moment', 'level', 'form', 'order',
  'view', 'sense', 'second', 'third', 'taken', 'given', 'known', 'done', 'gone', 'seen',
  'today', 'morning', 'looking', 'coming', 'going', 'trying', 'getting', 'making', 'taking', 'having',
]);

// Tier 3: Common words (rank 601-1500)
const EN_TIER_3_WORDS = new Set([
  // Actions and verbs
  'accept', 'achieve', 'act', 'affect', 'agree', 'apply', 'arrive', 'avoid', 'base', 'beat',
  'break', 'carry', 'catch', 'cause', 'choose', 'claim', 'close', 'compare', 'concern', 'contain',
  'control', 'cover', 'deal', 'describe', 'design', 'determine', 'discover', 'discuss', 'draw', 'drive',
  'drop', 'enjoy', 'enter', 'establish', 'exist', 'explain', 'express', 'fail', 'fight', 'fill',
  'finish', 'fly', 'force', 'forget', 'gain', 'gather', 'handle', 'hit', 'hope', 'identify',
  'imagine', 'improve', 'increase', 'indicate', 'influence', 'inform', 'introduce', 'involve', 'join', 'jump',
  'lack', 'laugh', 'lay', 'lie', 'listen', 'maintain', 'manage', 'mark', 'matter', 'measure',
  'mention', 'miss', 'notice', 'obtain', 'occur', 'operate', 'organize', 'perform',
  'pick', 'place', 'plan', 'prepare', 'present', 'press', 'prevent', 'produce', 'promise', 'protect',
  'prove', 'provide', 'publish', 'push', 'realize', 'receive', 'recognize', 'reduce', 'reflect', 'refuse',
  'relate', 'release', 'remove', 'replace', 'represent', 'respond', 'rest', 'return', 'reveal',
  'rise', 'roll', 'rule', 'save', 'seek', 'separate', 'share', 'shoot', 'sign', 'sing',
  'sleep', 'smile', 'solve', 'sort', 'sound', 'spread', 'step', 'strike', 'struggle',
  'succeed', 'suffer', 'support', 'suppose', 'surprise', 'survive', 'teach', 'tend', 'test', 'thank',
  'throw', 'touch', 'train', 'travel', 'treat', 'trust', 'visit', 'vote', 'wear', 'wish',
  'wonder', 'worry', 'worth',
  
  // Nouns
  'account', 'activity', 'administration', 'adult', 'advice', 'age', 'agency', 'agreement', 'air', 'amount',
  'analysis', 'animal', 'answer', 'application', 'approach', 'arm', 'army', 'art', 'article', 'artist',
  'attack', 'attention', 'audience', 'author', 'authority', 'baby', 'bag', 'ball', 'bank', 'bar',
  'basis', 'bed', 'behavior', 'benefit', 'bill', 'bit', 'blood', 'board', 'boat',
  'box', 'boy', 'brain', 'brother', 'budget', 'building', 'campaign', 'cancer', 'capital', 'career',
  'card', 'care', 'cell', 'center', 'century', 'chair', 'challenge', 'chance', 'character', 'charge',
  'choice', 'church', 'citizen', 'class', 'club', 'coach', 'college', 'color', 'comment', 'commission',
  'committee', 'computer', 'concept', 'condition', 'conference', 'congress', 'connection', 'conversation',
  'cost', 'council', 'couple', 'course', 'court', 'crime', 'culture', 'cup', 'customer', 'daughter',
  'data', 'death', 'debate', 'decision', 'degree', 'department', 'development', 'difference', 'director',
  'discussion', 'disease', 'doctor', 'dog', 'door', 'dream', 'drug', 'education', 'effect', 'effort',
  'election', 'employee', 'energy', 'environment', 'equipment', 'evening', 'event', 'evidence', 'example', 'executive',
  'experience', 'expert', 'factor', 'fan', 'film', 'finger', 'fire',
  'firm', 'fish', 'floor', 'focus', 'food', 'foot', 'fund', 'future',
  'garden', 'gas', 'girl', 'glass', 'goal', 'god', 'ground', 'growth', 'gun',
  'guy', 'hair', 'half', 'hall', 'heart', 'heat', 'hospital', 'hotel', 'image', 'impact',
  'individual', 'industry', 'interest', 'investment', 'item', 'judge', 'justice', 'kitchen', 'knowledge',
  'language', 'leader', 'learning', 'leg', 'letter', 'list', 'loss', 'machine', 'magazine',
  'management', 'manager', 'market', 'marriage', 'material', 'media', 'medical', 'meeting',
  'memory', 'message', 'method', 'middle', 'military', 'mind', 'model', 'movie',
  'music', 'nation', 'nature', 'network', 'news', 'newspaper', 'note', 'object', 'official',
  'oil', 'operation', 'opportunity', 'option', 'organization', 'owner', 'page', 'pain', 'painting', 'paper',
  'parent', 'partner', 'patient', 'pattern', 'peace', 'performance', 'period', 'person', 'phone', 'picture',
  'piece', 'plant', 'player', 'pm', 'police', 'policy', 'politics', 'population', 'position',
  'practice', 'pressure', 'price', 'principle', 'production', 'professional', 'professor', 'project', 'property', 'protection',
  'quality', 'race', 'radio', 'range', 'rate', 'reality', 'record', 'region', 'relationship',
  'religion', 'research', 'resource', 'response', 'responsibility', 'restaurant', 'risk', 'road',
  'rock', 'role', 'sale', 'scene', 'science', 'scientist', 'season', 'seat', 'section',
  'security', 'series', 'sex', 'ship', 'shot', 'single', 'sister',
  'site', 'situation', 'size', 'skill', 'skin', 'soldier', 'son', 'song', 'source', 'south', 'space', 'speech', 'spirit', 'sport', 'staff', 'stage', 'standard', 'star',
  'statement', 'station', 'status', 'stock', 'strategy', 'street', 'structure', 'success', 'summer', 'surface',
  'table', 'talk', 'task', 'tax', 'teacher', 'technology', 'television', 'term', 'text',
  'theory', 'thought', 'threat', 'title', 'top', 'total', 'town', 'trade', 'training',
  'treatment', 'trial', 'trip', 'trouble', 'truth', 'type', 'unit', 'university', 'value', 'variety',
  'version', 'victim', 'video', 'violence', 'voice', 'wall', 'war', 'weight',
  'west', 'wife', 'wind', 'window', 'winter', 'worker', 'writer', 'writing', 'yard',
  
  // Adjectives
  'available', 'average', 'aware', 'basic', 'beautiful', 'central', 'civil', 'cold', 'commercial',
  'common', 'complete', 'concerned', 'cultural', 'current', 'dark', 'dead', 'deep', 'democratic', 'difficult',
  'direct', 'effective', 'entire', 'environmental', 'essential', 'european', 'excellent', 'existing', 'fair', 'familiar',
  'famous', 'federal', 'final', 'financial', 'fine', 'foreign', 'former', 'forward', 'global',
  'green', 'happy', 'healthy', 'heavy', 'helpful', 'historical', 'hot', 'huge', 'independent',
  'industrial', 'interested', 'involved', 'key', 'legal', 'living', 'main', 'male',
  'mental', 'modern', 'natural', 'necessary', 'negative', 'nice', 'normal', 'obvious',
  'ok', 'okay', 'original', 'overall', 'particular', 'past', 'perfect', 'physical', 'poor',
  'popular', 'positive', 'potential', 'powerful', 'pretty', 'previous', 'primary', 'private',
  'proper', 'proud', 'quick', 'quiet', 'ready', 'regional', 'regular', 'related', 'religious',
  'responsible', 'rich', 'safe', 'scientific', 'senior', 'serious', 'sexual', 'significant', 'similar',
  'simple', 'slight', 'slow', 'specific', 'strange', 'successful', 'sudden',
  'traditional', 'typical', 'unique', 'unlikely', 'various', 'visual', 'warm', 'western', 'wide', 'wild',
  'willing', 'wrong',
  
  // Adverbs and others
  'absolutely', 'alone', 'anyway', 'apparently', 'approximately', 'badly', 'basically', 'carefully', 'closely', 'completely',
  'directly', 'easily', 'effectively', 'either', 'entirely', 'eventually', 'exactly', 'extremely', 'fairly', 'generally',
  'greatly', 'hardly', 'highly', 'immediately', 'indeed', 'initially', 'instead', 'largely', 'mainly', 'merely',
  'naturally', 'necessarily', 'normally', 'obviously', 'occasionally', 'originally', 'otherwise', 'partly', 'perfectly', 'personally',
  'possibly', 'potentially', 'primarily', 'properly', 'recently', 'relatively', 'seriously', 'significantly', 'similarly', 'slightly',
  'slowly', 'specifically', 'strongly', 'successfully', 'suddenly', 'therefore', 'thus', 'totally', 'truly', 'ultimately',
  'unfortunately', 'widely',
]);

// Tier 4: Less common but still recognized words (rank 1501-3000)
const EN_TIER_4_WORDS = new Set([
  // Academic and formal vocabulary
  'abandon', 'absence', 'absolute', 'abstract', 'abuse', 'academic', 'accelerate', 'accessible', 'accommodate', 'accompany',
  'accomplish', 'accurate', 'accuse', 'acknowledge', 'acquire', 'adapt', 'adequate', 'adjust', 'administrative', 'adopt',
  'advocate', 'aesthetic', 'agenda', 'aggressive', 'allocate', 'alter', 'alternative', 'amid', 'analyze', 'ancestor',
  'ancient', 'announce', 'annual', 'anticipate', 'anxiety', 'apparent', 'appeal', 'appreciate', 'appropriate', 'approve',
  'architect', 'arise', 'arrange', 'arrest', 'artificial', 'aspect', 'assault', 'assemble', 'assert', 'assess',
  'asset', 'assign', 'assist', 'assume', 'assumption', 'assure', 'atmosphere', 'attach', 'attain', 'attempt',
  'attribute', 'authentic', 'automatic', 'automobile', 'awareness', 'awful', 'bacteria', 'balance', 'barely', 'barrier',
  'battlefield', 'behalf', 'behavioral', 'beloved', 'beneath', 'benchmark', 'beneficial', 'beside', 'besides', 'bet',
  'bias', 'billion', 'bind', 'biological', 'bishop', 'blame', 'blend', 'bless', 'blind', 'block',
  'bold', 'bond', 'boom', 'boost', 'border', 'boring', 'borrow', 'boss', 'bother', 'boundary',
  'branch', 'brand', 'brave', 'breach', 'breakdown', 'breakthrough', 'breath', 'breed', 'brick', 'bridge',
  'brief', 'brilliant', 'broad', 'broadcast', 'broken', 'brown', 'brush', 'bulk', 'bullet', 'bunch',
  'burden', 'bureau', 'burn', 'burst', 'bury', 'busy', 'butter', 'cabin', 'cable', 'calculate',
  'calm', 'camera', 'campus', 'capable', 'capacity', 'capture', 'carbon', 'careful', 'cargo', 'carpet',
  'cast', 'casual', 'catalog', 'category', 'cattle', 'cave', 'cease', 'celebrate', 'celebrity', 'chain',
  'chamber', 'champion', 'channel', 'chaos', 'chapter', 'characteristic', 'charm', 'chart', 'chase', 'cheap',
  'cheat', 'chemical', 'chest', 'chicken', 'chief', 'childhood', 'chip', 'chronic', 'cigarette', 'circle',
  'circuit', 'circumstance', 'cite', 'civilian', 'civilization', 'clarify', 'classic', 'classification', 'classroom', 'clause',
  'clay', 'clean', 'clerk', 'clever', 'click', 'client', 'cliff', 'climate', 'climb', 'clinic',
  'clock', 'cloth', 'clothes', 'clothing', 'cloud', 'cluster', 'coalition', 'coast', 'code', 'cognitive',
  'coin', 'coincide', 'collapse', 'colleague', 'collective', 'colonial', 'colony', 'column', 'combat',
  'combination', 'combine', 'comfort', 'comfortable', 'command', 'commander', 'commence', 'commissioner', 'commit',
  'commitment', 'commodity', 'communicate', 'communication', 'compact', 'companion', 'comparable', 'comparative', 'comparison', 'compel',
  'compensate', 'compensation', 'compete', 'competition', 'competitive', 'competitor', 'complain', 'complaint', 'complement', 'complex',
  'complexity', 'compliance', 'complicate', 'component', 'compose', 'composition', 'compound', 'comprehensive', 'comprise', 'compromise',
  'compute', 'conceive', 'concentrate', 'concentration', 'conception', 'conclude', 'conclusion', 'concrete', 'conduct', 'confession',
  'confidence', 'confident', 'confine', 'confirm', 'conflict', 'confront', 'confusion', 'congressional', 'conjunction', 'connect',
  'conscience', 'conscious', 'consciousness', 'consensus', 'consent', 'consequence', 'conservative', 'considerable', 'consideration', 'consist',
  'consistent', 'constant', 'constitute', 'constitution', 'constitutional', 'constraint', 'construct', 'construction', 'consult', 'consultant',
  'consume', 'consumer', 'consumption', 'contact', 'contemporary', 'content', 'contest', 'context', 'continent', 'contract',
  'contradiction', 'contrary', 'contrast', 'contribute', 'contribution', 'controversy', 'convenient', 'convention', 'conventional',
  'conversion', 'convert', 'convey', 'conviction', 'convince', 'cooperate', 'cooperation', 'coordinate', 'cope', 'core',
  'corn', 'corner', 'corporate', 'corporation', 'correct', 'correlation', 'correspond', 'correspondent', 'corridor', 'corrupt',
  'corruption', 'costly', 'cottage', 'cotton', 'counter', 'counterpart', 'county', 'courage', 'cousin', 'coverage',
  'crack', 'craft', 'crash', 'crawl', 'crazy', 'cream', 'creative', 'creature', 'credibility', 'credit',
  'crew', 'criminal', 'crisis', 'criteria', 'criterion', 'critic', 'critical', 'criticism', 'criticize', 'crop',
  'cross', 'crowd', 'crucial', 'crude', 'cruel', 'cry', 'crystal', 'cultivate', 'curiosity', 'curious',
  'currency', 'curriculum', 'curtain', 'curve', 'custom', 'cycle', 'daily', 'dairy', 'damage', 'dance',
  'danger', 'dangerous', 'dare', 'database', 'dawn', 'deadly', 'dealer', 'dean', 'dear', 'decent',
  'declaration', 'declare', 'decline', 'decorate', 'decrease', 'dedicate', 'deem', 'defeat', 'defend', 'defendant',
  'defense', 'defensive', 'deficit', 'define', 'definition', 'delay', 'delegate', 'deliberate', 'delicate', 'deliver',
  'delivery', 'demand', 'democracy', 'demonstrate', 'demonstration', 'denial', 'dense', 'deny', 'depart',
  'dependent', 'depict', 'deploy', 'deposit', 'depress', 'depression', 'depth', 'deputy', 'derive', 'descend',
  'desert', 'deserve', 'designate', 'designer', 'desire', 'desk', 'desperate', 'destination', 'destroy', 'destruction',
  'detail', 'detect', 'detection', 'detective', 'determination', 'device', 'devote', 'dialogue', 'diamond', 'diary',
  'dictate', 'diet', 'differ', 'differently', 'dig', 'digital', 'dignity', 'dilemma', 'dimension', 'diminish',
  'dining', 'diplomat', 'diplomatic', 'disability', 'disagree', 'disappear', 'disaster', 'discipline', 'disclose', 'discourse',
  'discrimination', 'disorder', 'display', 'disposal', 'dispose', 'dispute', 'disrupt', 'dissolve', 'distance', 'distant',
  'distinct', 'distinction', 'distinguish', 'distort', 'distribute', 'distribution', 'district', 'disturb', 'diverse', 'diversity',
  'divide', 'division', 'divorce', 'doctrine', 'document', 'documentary', 'dollar', 'domain', 'domestic', 'dominant',
  'dominate', 'donate', 'donor', 'dose', 'double', 'doubt', 'downtown', 'dozen', 'draft', 'drag',
  'drain', 'drama', 'dramatic', 'dramatically', 'drawer', 'drawing', 'dread', 'drift', 'drill',
  'drink', 'drought', 'drown', 'drunk', 'dry', 'dual', 'duck', 'due', 'dumb', 'dump',
  'dust', 'duty', 'dwell', 'dynamic', 'eager', 'earn', 'earnings', 'earthquake', 'ease', 'east',
  'eastern', 'echo', 'ecological', 'ecology', 'edge', 'edit', 'edition', 'editor', 'editorial', 'educate',
  'educator', 'efficiency', 'efficient', 'egg', 'elaborate', 'elderly', 'elect', 'electrical', 'electricity', 'electron',
  'electronic', 'element', 'elementary', 'elephant', 'elevate', 'elite', 'elsewhere', 'email', 'embed', 'embody',
  'embrace', 'emerge', 'emergence', 'emergency', 'emission', 'emotion', 'emotional', 'emperor', 'emphasis', 'emphasize',
  'empire', 'employ', 'employer', 'employment', 'empty', 'enable', 'enact', 'encounter', 'encourage', 'endless',
  'endorse', 'endure', 'enemy', 'enforce', 'enforcement', 'engage', 'engagement', 'engine', 'engineer', 'engineering',
  'enhance', 'enormous', 'enquiry', 'ensure', 'enterprise', 'entertainment', 'enthusiasm', 'enthusiastic', 'entity',
  'entrance', 'entrepreneur', 'entry', 'envelope', 'episode', 'equal', 'equality', 'equally', 'equation', 'equip',
  'equivalent', 'era', 'error', 'escape', 'essay', 'essence', 'estate', 'estimate', 'eternal', 'ethical',
  'ethics', 'ethnic', 'evaluate', 'evaluation', 'everyday', 'evil', 'evolution', 'evolve', 'exact', 'exam',
  'examination', 'examine', 'exceed', 'exception', 'excess', 'excessive', 'exchange', 'excitement', 'exclude', 'exclusive',
  'excuse', 'execute', 'execution', 'exempt', 'exhibit', 'exhibition', 'exile', 'expansion',
  'expectation', 'expense', 'expensive', 'experiment', 'experimental', 'expertise', 'expire', 'explanation', 'explicit', 'explode',
  'exploit', 'exploration', 'explore', 'explorer', 'explosion', 'export', 'expose', 'exposure', 'extend', 'extension',
  'extensive', 'extent', 'external', 'extra', 'extract', 'extraordinary', 'extreme', 'fabric', 'facilitate', 'facility',
  'fade', 'failure', 'fairy', 'faith', 'faithful', 'fake', 'fame', 'fancy', 'fantasy',
  'fare', 'farm', 'farmer', 'farming', 'fascinating', 'fashion', 'fast', 'fat', 'fatal', 'fate',
  'fault', 'favor', 'favorable', 'favorite', 'fear', 'feast', 'feat', 'feather', 'feature', 'fee',
  'feedback', 'fellow', 'female', 'fence', 'festival', 'fever', 'fiber', 'fiction', 'fierce', 'fifteen',
]);

// ============================================================================
// NORWEGIAN WORD FREQUENCY DATA
// ============================================================================

// Norwegian Tier 1: Most common words (rank 1-150)
const NO_TIER_1_WORDS = new Set([
  // Function words and pronouns
  'og', 'i', 'er', 'det', 'som', 'en', 'på', 'å', 'av', 'for',
  'med', 'har', 'til', 'de', 'den', 'ikke', 'om', 'et', 'var', 'jeg',
  'men', 'så', 'vi', 'han', 'du', 'kan', 'skal', 'seg', 'fra', 'eller',
  'etter', 'ved', 'også', 'være', 'vil', 'hun', 'alle', 'sin', 'når', 'her',
  'nå', 'bare', 'meg', 'mot', 'dette', 'dem', 'ham', 'opp', 'ut', 'inn',
  'over', 'selv', 'mange', 'andre', 'blir', 'før', 'meget', 'få', 'dag', 'ble',
  'disse', 'kunne', 'har', 'ville', 'hva', 'hele', 'siden', 'under', 'går', 'år',
  'kom', 'hadde', 'hvor', 'hvis', 'slik', 'enn', 'helt', 'jo', 'ned', 'blitt',
  'både', 'gang', 'tid', 'noen', 'få', 'gjøre', 'ta', 'sa', 'gi', 'se',
  'del', 'oss', 'der', 'første', 'være', 'måtte', 'måte', 'stor', 'gå', 'kom',
  // Additional common words
  'nye', 'godt', 'land', 'samme', 'skulle', 'mann', 'aldri', 'egen', 'god', 'ingen',
  'litt', 'sier', 'stor', 'større', 'må', 'henne', 'stort', 'siste', 'to', 'tre',
  'ting', 'altså', 'jo', 'ja', 'nei', 'hver', 'hvem', 'hvordan', 'hvorfor', 'heller',
]);

// Norwegian Tier 2: Very common words (rank 151-600)
const NO_TIER_2_WORDS = new Set([
  // Common verbs
  'komme', 'gjøre', 'finne', 'stå', 'ta', 'sette', 'ligge', 'bruke', 'vite', 'tro',
  'tenke', 'si', 'lese', 'skrive', 'arbeide', 'leve', 'holde', 'kalle', 'føle', 'mene',
  'synes', 'høre', 'snakke', 'fortelle', 'spørre', 'svare', 'vise', 'begynne', 'slutte', 'fortsette',
  'prøve', 'legge', 'sitte', 'løpe', 'gå', 'flytte', 'kjøre', 'reise', 'handle', 'kjøpe',
  'selge', 'betale', 'koste', 'hjelpe', 'støtte', 'bygge', 'lage', 'skape', 'utvikle', 'endre',
  'øke', 'redusere', 'åpne', 'lukke', 'starte', 'stoppe', 'vente', 'møte', 'forstå', 'huske',
  'glemme', 'lære', 'undervise', 'studere', 'jobbe', 'spille', 'vinne', 'tape', 'delta', 'bestemme',
  
  // Common nouns
  'menneske', 'barn', 'kvinne', 'folk', 'liv', 'verden', 'sted', 'hus', 'hjem', 'familie',
  'venn', 'mor', 'far', 'bror', 'søster', 'datter', 'sønn', 'navn', 'ord', 'språk',
  'bok', 'side', 'bilde', 'film', 'musikk', 'kunst', 'historie', 'spørsmål', 'svar', 'problem',
  'løsning', 'arbeid', 'jobb', 'penger', 'pris', 'verdi', 'grunn', 'årsak', 'resultat', 'effekt',
  'mål', 'plan', 'idé', 'tanke', 'mening', 'følelse', 'håp', 'frykt', 'kjærlighet', 'hat',
  'vann', 'mat', 'drikke', 'kropp', 'hode', 'hånd', 'øye', 'ansikt', 'hjerte', 'blod',
  'by', 'gate', 'vei', 'kirke', 'skole', 'sykehus', 'butikk', 'marked', 'samfunn', 'stat',
  'regjering', 'parti', 'valg', 'lov', 'rett', 'frihet', 'makt', 'krig', 'fred', 'sikkerhet',
  
  // Common adjectives
  'god', 'ny', 'gammel', 'ung', 'stor', 'liten', 'lang', 'kort', 'høy', 'lav',
  'bred', 'smal', 'tykk', 'tynn', 'hard', 'myk', 'varm', 'kald', 'våt', 'tørr',
  'rik', 'fattig', 'sterk', 'svak', 'rask', 'langsom', 'lett', 'vanskelig', 'enkel', 'kompleks',
  'viktig', 'nødvendig', 'mulig', 'umulig', 'sikker', 'usikker', 'klar', 'uklar', 'ren', 'skitten',
  'vakker', 'stygg', 'glad', 'trist', 'sint', 'rolig', 'stille', 'høyt', 'lavt', 'full',
  'tom', 'åpen', 'lukket', 'fri', 'opptatt', 'ferdig', 'klar', 'redd', 'modig', 'snill',
  
  // Common adverbs
  'ikke', 'også', 'bare', 'kanskje', 'sikkert', 'virkelig', 'egentlig', 'faktisk', 'dessverre', 'heldigvis',
  'alltid', 'aldri', 'ofte', 'sjelden', 'noen', 'gang', 'iblant', 'vanligvis', 'plutselig', 'gradvis',
  'raskt', 'sakte', 'tidlig', 'sent', 'snart', 'straks', 'allerede', 'ennå', 'fortsatt', 'igjen',
  'sammen', 'alene', 'borte', 'hjemme', 'ute', 'inne', 'oppe', 'nede', 'fremme', 'tilbake',
]);

// Norwegian Tier 3: Common words (rank 601-1500)
const NO_TIER_3_WORDS = new Set([
  // Actions and verbs
  'akseptere', 'analysere', 'anta', 'anvende', 'avslutte', 'avvise', 'behandle', 'beholde', 'bekrefte', 'bekymre',
  'beregne', 'beskrive', 'beskytte', 'besøke', 'bety', 'bevege', 'bidra', 'danne', 'dele', 'demonstrere',
  'diskutere', 'dominere', 'drepe', 'drive', 'dømme', 'eksistere', 'eksportere', 'eliminere', 'endre', 'engasjere',
  'erstatte', 'etablere', 'evaluere', 'fastslå', 'feile', 'feire', 'finansiere', 'fokusere', 'forbedre', 'forby',
  'fordele', 'foreslå', 'forestille', 'forhandle', 'forklare', 'forlate', 'forme', 'formulere', 'fornye', 'forske',
  'forsøke', 'forstyrre', 'forsvare', 'forsvinne', 'fortjene', 'forvirre', 'fremme', 'garantere', 'godkjenne', 'gripe',
  'håndtere', 'identifisere', 'ignorere', 'illustrere', 'importere', 'informere', 'inkludere', 'inneholde', 'innføre', 'innse',
  'inspirere', 'installere', 'interessere', 'investere', 'invitere', 'kjempe', 'knytte', 'kombinere', 'kommunisere', 'konkludere',
  'konkurrere', 'konsultere', 'kontakte', 'kontrollere', 'konvertere', 'kopiere', 'korrigere', 'koste', 'kreve', 'kritisere',
  
  // Nouns
  'administrasjon', 'aktør', 'aktivitet', 'alternativ', 'analyse', 'ansvar', 'argument', 'aspekt', 'atmosfære', 'autoritet',
  'avdeling', 'avis', 'avtale', 'bakgrunn', 'balanse', 'bank', 'basis', 'befolkning', 'begrep', 'behov',
  'bevis', 'betydning', 'bevegelse', 'bibliotek', 'bidrag', 'borger', 'bransje', 'budsjett', 'bygning', 'data',
  'debatt', 'definisjon', 'demokrati', 'detalj', 'dialog', 'dimensjon', 'dokument', 'domstol', 'drøm', 'dynamikk',
  'egenskap', 'eier', 'eksempel', 'ekspert', 'element', 'energi', 'enhet', 'erfaring', 'erklæring', 'etikk',
  'faktor', 'fase', 'fenomen', 'figur', 'filosofi', 'fokus', 'fordel', 'foreldre', 'forening', 'forfatter',
  'forhandling', 'forhold', 'forklaring', 'form', 'formål', 'forskning', 'forslag', 'forståelse', 'fortsettelse', 'frihet',
  'funksjon', 'fylke', 'gevinst', 'grad', 'grense', 'gruppe', 'gutt', 'handling', 'hendelse', 'hensikt',
  
  // Adjectives
  'absolutt', 'akseptabel', 'aktuell', 'allmenn', 'alternativ', 'ansvarlig', 'betydelig', 'daglig', 'demokratisk', 'direkte',
  'effektiv', 'eksakt', 'ekstra', 'elektrisk', 'endelig', 'eneste', 'enorm', 'europeisk', 'eventuell', 'fantastisk',
  'farlig', 'felles', 'finansiell', 'foreløpig', 'formell', 'fornuftig', 'forsiktig', 'forskjellig', 'framtidig', 'generell',
  'geografisk', 'gjeldende', 'global', 'grundig', 'gyldig', 'helhetlig', 'historisk', 'hovedsakelig', 'hyppig', 'ideell',
  'imponerende', 'indirekte', 'individuell', 'industriell', 'interessant', 'intern', 'internasjonal', 'juridisk', 'klassisk', 'klinisk',
  'kollektiv', 'kommersiell', 'komplett', 'konkret', 'konstant', 'konstruktiv', 'kontinuerlig', 'kreativ', 'kritisk', 'kulturell',
  'kunstig', 'kvalifisert', 'lokal', 'logisk', 'lovlig', 'maksimal', 'materiell', 'meningsfull', 'merkbar', 'metodisk',
  'militær', 'minimal', 'moderne', 'moralsk', 'nasjonal', 'naturlig', 'negativ', 'nervøs', 'nøyaktig', 'nøytral',
]);

// Norwegian Tier 4: Less common words (rank 1501-3000)
const NO_TIER_4_WORDS = new Set([
  // Academic and formal vocabulary
  'abstrakt', 'akademisk', 'akselerere', 'akutt', 'algoritme', 'allegorisk', 'ambisiøs', 'analytisk', 'anerkjenne', 'anonymisere',
  'antagonist', 'antropologi', 'anvendelig', 'aristokrati', 'arkitektonisk', 'arrogant', 'artikulere', 'assimilere', 'asymmetrisk', 'autentisk',
  'autoritær', 'avansert', 'bakterie', 'banal', 'begrense', 'bekreftelse', 'beredskapsmessig', 'berettiget', 'besettelse', 'bibliografi',
  'bilateral', 'biografi', 'biologisk', 'bioteknologi', 'bisarr', 'bærekraftig', 'byråkrati', 'cerebral', 'karakteristisk', 'karismatisk',
  'kategorisere', 'kjemisk', 'klassifisere', 'klimatisk', 'koherent', 'kollidere', 'kolonial', 'kompatibel', 'kompensere', 'komplisert',
  'komponere', 'kompromittere', 'konfidensielt', 'konfrontere', 'konservativ', 'konsolidere', 'konstitusjonell', 'kontekst', 'kontrast', 'kontrovers',
  'konvensjonell', 'koordinere', 'korporativ', 'korrelasjon', 'korrespondere', 'kosmopolitisk', 'kriminell', 'kronologisk', 'kuriositet', 'kvalitativ',
  'kvantitativ', 'kybernetikk', 'legitimere', 'liberal', 'lingvistisk', 'litterær', 'logistikk', 'lukrativ', 'makroøkonomisk', 'manifestere',
  'manipulere', 'marginalisere', 'meditasjon', 'mellommenneskelig', 'mentalitet', 'metabolisme', 'metafor', 'metamorfose', 'metodologi', 'mikroskopisk',
  'minimalistisk', 'mobilisere', 'modifisere', 'molekylær', 'monopol', 'monoton', 'monumental', 'multikulturell', 'muskulær', 'mystisk',
  'navigere', 'nettverksbygging', 'nevrologisk', 'nominere', 'normalisere', 'nostalgi', 'notorisk', 'numerisk', 'objektiv', 'obligatorisk',
  'observere', 'offensiv', 'oligarki', 'ominøs', 'omnipotent', 'operasjonell', 'opportunistisk', 'optimalisere', 'orkestrere', 'ortodoks',
  'oscillere', 'paradigme', 'paradoks', 'parallell', 'parameter', 'paranoid', 'patologi', 'patriarkalsk', 'pedagogisk', 'perifer',
  'permanent', 'personifisere', 'perspektiv', 'pessimistisk', 'phenomenon', 'pionér', 'pittoresk', 'plagiering', 'polemisk', 'politisere',
  'populisme', 'potensiell', 'pragmatisk', 'predikere', 'predominant', 'preferanse', 'prejudisert', 'prematur', 'prestisjefylt', 'prevalens',
]);

// ============================================================================
// LANGUAGE-SPECIFIC CONFIGURATION
// ============================================================================

// Word lists by language
const WORD_TIERS: Record<'en' | 'no', { tier1: Set<string>; tier2: Set<string>; tier3: Set<string>; tier4: Set<string> }> = {
  en: {
    tier1: EN_TIER_1_WORDS,
    tier2: EN_TIER_2_WORDS,
    tier3: EN_TIER_3_WORDS,
    tier4: EN_TIER_4_WORDS,
  },
  no: {
    tier1: NO_TIER_1_WORDS,
    tier2: NO_TIER_2_WORDS,
    tier3: NO_TIER_3_WORDS,
    tier4: NO_TIER_4_WORDS,
  },
};

// Frequency tier -> speed multiplier mapping
// Lower multiplier = faster reading (more common word)
// Higher multiplier = slower reading (rare word)
const TIER_MULTIPLIERS: Record<number, number> = {
  1: 0.7,   // Very common words - 30% faster
  2: 0.85,  // Common words - 15% faster
  3: 1.0,   // Standard words - normal speed
  4: 1.15,  // Less common words - 15% slower
  5: 1.3,   // Rare/complex words - 30% slower
};

// Common suffixes for morphological matching by language
const COMMON_SUFFIXES: Record<'en' | 'no', string[]> = {
  en: [
    'ing', 'ed', 'es', 's', 'er', 'est', 'ly', 'ment', 'ness', 'tion', 
    'sion', 'able', 'ible', 'ful', 'less', 'ous', 'ive', 'al', 'ial'
  ],
  no: [
    'ing', 'ene', 'ene', 'er', 'et', 'en', 'a', 'te', 'de', 'ende',
    'else', 'het', 'lig', 'isk', 'som', 'bar', 'løs', 'full', 'aktig', 'messig'
  ],
};

// Character patterns for word normalization by language
const WORD_CHAR_PATTERN: Record<'en' | 'no', RegExp> = {
  en: /[^a-z]/g,
  no: /[^a-zæøå]/g,
};

/**
 * Try to find the stem of a word by removing common suffixes
 * Returns the stem variants for lookup
 */
function getStemVariants(word: string, language: 'en' | 'no'): string[] {
  const variants = [word];
  const suffixes = COMMON_SUFFIXES[language];
  
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      const stem = word.slice(0, -suffix.length);
      variants.push(stem);
      
      // Handle doubling consonants (running -> run)
      if (stem.length > 1 && stem[stem.length - 1] === stem[stem.length - 2]) {
        variants.push(stem.slice(0, -1));
      }
      
      // Handle -e dropping (making -> make)
      variants.push(stem + 'e');
      
      // Handle -y to -i (happiness -> happy)
      if (stem.endsWith('i')) {
        variants.push(stem.slice(0, -1) + 'y');
      }
    }
  }
  
  return variants;
}

/**
 * Get the frequency tier of a word (1-5)
 * 1 = most common, 5 = rare/complex
 * 
 * @param word - The word to check
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function getWordFrequencyTier(word: string, language: SupportedLanguage = 'en'): 1 | 2 | 3 | 4 | 5 {
  // Resolve language
  const lang: 'en' | 'no' = language === 'auto' ? detectLanguage(word) : language;
  const tiers = WORD_TIERS[lang];
  const charPattern = WORD_CHAR_PATTERN[lang];
  
  const normalized = word.toLowerCase().replace(charPattern, '');
  
  if (!normalized || normalized.length === 0) {
    return 3; // Punctuation, numbers, etc. - normal speed
  }
  
  // Direct lookup first
  if (tiers.tier1.has(normalized)) return 1;
  if (tiers.tier2.has(normalized)) return 2;
  if (tiers.tier3.has(normalized)) return 3;
  if (tiers.tier4.has(normalized)) return 4;
  
  // Try morphological variants (stemming)
  const variants = getStemVariants(normalized, lang);
  for (const variant of variants) {
    if (tiers.tier1.has(variant)) return 1;
    if (tiers.tier2.has(variant)) return 2;
    if (tiers.tier3.has(variant)) return 3;
    if (tiers.tier4.has(variant)) return 4;
  }
  
  // Heuristics for completely unknown words
  const length = normalized.length;
  
  // Very short words are likely common
  if (length <= 3) return 2;
  
  // Long words are likely complex
  if (length >= 10) return 5;
  if (length >= 8) return 4;
  
  return 4; // Default: slightly slower for unknown words
}

/**
 * Get the speed multiplier for a word based on frequency
 * Lower = faster, Higher = slower
 * 
 * @param word - The word to check
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function getWordSpeedMultiplier(word: string, language: SupportedLanguage = 'en'): number {
  const tier = getWordFrequencyTier(word, language);
  return TIER_MULTIPLIERS[tier];
}

/**
 * Check if a word is in the common vocabulary
 * 
 * @param word - The word to check
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function isCommonWord(word: string, language: SupportedLanguage = 'en'): boolean {
  const tier = getWordFrequencyTier(word, language);
  return tier <= 3;
}

/**
 * Calculate difficulty score for a word (0-1)
 * Combines frequency and length
 * 
 * @param word - The word to check
 * @param language - Language code ('en', 'no', or 'auto' for detection)
 */
export function getWordDifficulty(word: string, language: SupportedLanguage = 'en'): number {
  const lang: 'en' | 'no' = language === 'auto' ? detectLanguage(word) : language;
  const charPattern = WORD_CHAR_PATTERN[lang];
  
  const tier = getWordFrequencyTier(word, language);
  const normalized = word.toLowerCase().replace(charPattern, '');
  const length = normalized.length;
  
  // Frequency component (0-1)
  const frequencyScore = (tier - 1) / 4;
  
  // Length component (0-1)
  const lengthScore = Math.min(1, Math.max(0, (length - 3) / 10));
  
  // Combined score: 60% frequency, 40% length
  return frequencyScore * 0.6 + lengthScore * 0.4;
}

/**
 * Get the total word count in the frequency lists for a language
 * 
 * @param language - Language code ('en' or 'no')
 */
export function getVocabularySize(language: 'en' | 'no' = 'en'): number {
  const tiers = WORD_TIERS[language];
  return tiers.tier1.size + tiers.tier2.size + tiers.tier3.size + tiers.tier4.size;
}

/**
 * Get vocabulary sizes for all supported languages
 */
export function getAllVocabularySizes(): Record<'en' | 'no', number> {
  return {
    en: getVocabularySize('en'),
    no: getVocabularySize('no'),
  };
}
