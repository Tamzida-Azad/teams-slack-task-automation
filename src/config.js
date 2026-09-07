const path = require('path');

const rootDir = path.resolve(__dirname, '..');

module.exports = {
  rootDir,
  channels: [
    'CalystaPro Support Team',
    'CRM - Live',
    'Calystapro EMR Web Dev',
    'Calystapro EMR Feature Highlights',
    'CalystaproEMR - CRM',
    "CalystaPro EMR | Rani's Requests",
  ],
  clientAuthors: [
    'Aaron Yuen',
    'Hardik Soni',
    'Lori Gobert',
    'Rani Houlis',
    'Rima Shah',
    'Jhara Mae Infante',
    'Lucian Lekaj',
  ],
  owners: ['Tamzida', 'Ashik', 'Rajib', 'Rezvi', 'Pranav'],
  /** Slack member IDs for @mentions in #calystaproemr payloads (`<@U…>`). */
  slackUserIds: {
    Tamzida: 'U03JR0Q2AAG',
    Ashik: 'U06CGT7VDH6',
    Rajib: 'U084FG0542K',
    Rezvi: 'U06GSPAEB8B',
    Pranav: 'U07EVSP002F',
  },
  slack: {
    workspaceUrl: 'https://sjinnovation.slack.com/',
    teamId: 'T0285LK1G',
    channelName: 'calystaproemr',
    channelId: 'GGWTSNWTC',
  },
  paths: {
    browserProfile: path.join(rootDir, 'browser-profile'),
    logsDir: path.join(rootDir, 'logs'),
    messagesJson: path.join(rootDir, 'logs', 'teams-messages.json'),
    payloadTxt: path.join(rootDir, 'logs', 'slack-payload.txt'),
    envPath: path.join(rootDir, '.env'),
  },
  urls: {
    teams: 'https://teams.live.com/v2/',
  },
  timeouts: {
    navigation: 60_000,
    action: 20_000,
  },
};
