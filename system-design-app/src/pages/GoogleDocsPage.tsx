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
  Chip,
  Tabs,
  Tab,
} from '@mui/material';

const documents = [
  { id: 1, title: 'System Design Overview', description: 'A high-level architecture document for scaling services.' },
  { id: 2, title: 'API Contract', description: 'Detailed request and response contracts for system endpoints.' },
  { id: 3, title: 'Deployment Guide', description: 'Infrastructure and release notes for production rollout.' },
];

const languages = ['English', 'Spanish', 'French', 'Chinese'].map((label) => ({ label, value: label.toLowerCase() }));

function GoogleDocsPage() {
  const [language, setLanguage] = useState<string>('english');
  const [selectedDoc, setSelectedDoc] = useState(documents[0]);
  const [notes, setNotes] = useState('Use this panel to capture document-specific collaboration notes.');
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: unknown, newValue: number) => setTabValue(newValue);

  const previewText = useMemo(() => {
    return `Document: ${selectedDoc.title}\nLanguage: ${language}\n\n${selectedDoc.description}\n\nDocumentation content appears here for review and collaboration.`;
  }, [language, selectedDoc]);

  const handleLanguageChange = (event: SelectChangeEvent<string>) => {
    setLanguage(event.target.value as string);
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
        Google Docs Style Workspace
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Select a document, switch the language, and manage notes for system design documentation.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          <Tab label="Functionality" />
          <Tab label="Documentation" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Documents
              </Typography>
              <Stack spacing={1}>
                {documents.map((doc) => (
                  <Button
                    key={doc.id}
                    variant={selectedDoc.id === doc.id ? 'contained' : 'outlined'}
                    onClick={() => setSelectedDoc(doc)}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    fullWidth
                  >
                    {doc.title}
                  </Button>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Options
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="google-docs-language-label">Language</InputLabel>
                <Select labelId="google-docs-language-label" value={language} label="Language" onChange={handleLanguageChange}>
                  {languages.map((lang) => (
                    <MenuItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box mt={2}>
                <Typography variant="subtitle1">Active document</Typography>
                <Chip label={selectedDoc.title} />
              </Box>
              <Box mt={2}>
                <Typography variant="subtitle1">Notes</Typography>
                <TextField
                  multiline
                  minRows={4}
                  fullWidth
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
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
            <Stack spacing={2}>
              {documents.map((doc) => (
                <Card key={doc.id} variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {doc.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {doc.description}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Document Preview
          </Typography>
          <Box component="pre" sx={codeBlockSx}>
            {previewText}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default GoogleDocsPage;
