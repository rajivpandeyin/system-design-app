import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';

const sampleItems = [
  { id: 1, alias: 'flairx.io/launch', destination: 'https://example.com/launch' },
  { id: 2, alias: 'flairx.io/docs', destination: 'https://example.com/docs' },
];

const languages = ['JavaScript', 'TypeScript', 'Python', 'Go'].map((label) => ({ label, value: label.toLowerCase() }));

function UrlShortenerPage() {
  const [language, setLanguage] = useState<string>('javascript');
  const [newUrl, setNewUrl] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const generatedCode = useMemo(() => {
    if (!newUrl || !newAlias) {
      return `// Enter a source URL and alias to see code snippets.`;
    }
    if (language === 'python') {
      return `import requests

payload = {
  'destination': '${newUrl}',
  'alias': '${newAlias}',
}

response = requests.post('https://api.example.com/shorten', json=payload)
print(response.json())`;
    }
    if (language === 'go') {
      return `package main

import (
  "bytes"
  "encoding/json"
  "net/http"
)

type payload struct {
  Destination string ` + "`json:\"destination\"`" + `
  Alias       string ` + "`json:\"alias\"`" + `
}

func main() {
  body, _ := json.Marshal(payload{Destination: "${newUrl}", Alias: "${newAlias}"})
  http.Post("https://api.example.com/shorten", "application/json", bytes.NewBuffer(body))
}`;
    }
    return `const payload = {
  destination: '${newUrl}',
  alias: '${newAlias}',
};
fetch('https://api.example.com/shorten', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
}).then((res) => res.json()).then(console.log);`;
  }, [language, newUrl, newAlias]);

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    setLanguage(event.target.value as string);
  };

  const handleCreate = () => {
    if (!newUrl || !newAlias) return;
    setNewUrl('');
    setNewAlias('');
  };

  const handleTabChange = (_event: unknown, newValue: number) => {
    setTabValue(newValue);
  };

  const codeBlockSx = {
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'monospace',
    bgcolor: '#f5f5f5',
    p: 2,
    borderRadius: 1,
    overflow: 'auto',
    maxWidth: '100%',
    fontSize: { xs: '0.75rem', sm: '0.875rem' },
  };

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
        URL Shortener
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Manage your short links, choose the implementation language, and review the generated request snippet for the service.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          <Tab label="Functionality" />
          <Tab label="Documentation" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
            <TextField label="Source URL" fullWidth value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
            <TextField label="Alias" fullWidth value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
            <FormControl sx={{ minWidth: { xs: '100%', sm: 160 }, width: { xs: '100%', sm: 'auto' } }}>
              <InputLabel id="shortener-language-label">Language</InputLabel>
              <Select labelId="shortener-language-label" value={language} label="Language" onChange={handleLanguageChange}>
                {languages.map((lang) => (
                  <MenuItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleCreate} sx={{ minWidth: { xs: '100%', sm: 140 }, width: { xs: '100%', sm: 'auto' } }}>
              Create
            </Button>
          </Stack>

          <Box sx={{ display: 'grid', gap: 2 }}>
            {sampleItems.map((item) => (
              <Card key={item.id} variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {item.alias}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Redirects to {item.destination}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Example request snippet
              </Typography>
              <Box component="pre" sx={codeBlockSx}>
                {generatedCode}
              </Box>
            </CardContent>
          </Card>
        </Stack>
      )}

      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Documentation
            </Typography>
            <Typography variant="body1" color="text.secondary">
              URL Shortener system design documentation and resources will appear here.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

export default UrlShortenerPage;
