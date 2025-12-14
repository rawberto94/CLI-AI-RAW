'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Users,
  History,
  MessageSquare,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Save,
  Download,
  Share2,
  Eye,
  Edit3,
  Lock,
  Unlock,
  ChevronDown,
  Sparkles,
  GitBranch,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Image as ImageIcon,
  Table,
  Code,
  Heading1,
  Heading2,
  Quote,
  MoreHorizontal,
  X,
  Send,
  Clock,
  User,
  Bookmark,
  Flag,
} from 'lucide-react';

interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  isActive: boolean;
  lastSeen: string;
}

interface Comment {
  id: string;
  author: string;
  authorAvatar?: string;
  content: string;
  timestamp: string;
  resolved: boolean;
  position: { paragraph: number; offset: number };
  replies: Array<{
    id: string;
    author: string;
    content: string;
    timestamp: string;
  }>;
}

interface Suggestion {
  id: string;
  type: 'improvement' | 'compliance' | 'risk' | 'clarity';
  text: string;
  originalText: string;
  suggestedText: string;
  position: { start: number; end: number };
  confidence: number;
  source: string;
}

interface Version {
  id: string;
  version: string;
  author: string;
  timestamp: string;
  changes: number;
  label?: string;
}

const mockCollaborators: Collaborator[] = [
  { id: '1', name: 'Sarah Chen', color: '#3B82F6', isActive: true, lastSeen: 'now' },
  { id: '2', name: 'Mike Johnson', color: '#10B981', isActive: true, lastSeen: 'now' },
  { id: '3', name: 'Lisa Park', color: '#8B5CF6', isActive: false, lastSeen: '5m ago' },
];

const mockComments: Comment[] = [
  {
    id: 'c1',
    author: 'Sarah Chen',
    content: 'We should strengthen this liability clause based on our playbook.',
    timestamp: '2 hours ago',
    resolved: false,
    position: { paragraph: 3, offset: 150 },
    replies: [
      { id: 'r1', author: 'Mike Johnson', content: 'Agreed, Ill draft an alternative.', timestamp: '1 hour ago' },
    ],
  },
  {
    id: 'c2',
    author: 'Legal Team',
    content: 'This termination clause needs review for compliance.',
    timestamp: '1 day ago',
    resolved: true,
    position: { paragraph: 7, offset: 50 },
    replies: [],
  },
];

const mockSuggestions: Suggestion[] = [
  {
    id: 's1',
    type: 'risk',
    text: 'Liability cap missing',
    originalText: 'The Vendor shall be liable for all damages',
    suggestedText: 'The Vendor\'s liability shall be limited to the total fees paid under this Agreement',
    position: { start: 450, end: 495 },
    confidence: 0.92,
    source: 'Company Playbook',
  },
  {
    id: 's2',
    type: 'compliance',
    text: 'GDPR clause recommended',
    originalText: 'Data handling procedures',
    suggestedText: 'Data handling procedures in accordance with GDPR and applicable data protection laws',
    position: { start: 890, end: 920 },
    confidence: 0.88,
    source: 'Regulatory Requirements',
  },
  {
    id: 's3',
    type: 'clarity',
    text: 'Ambiguous language',
    originalText: 'reasonable efforts',
    suggestedText: 'commercially reasonable efforts as defined in Section 1.2',
    position: { start: 1250, end: 1270 },
    confidence: 0.75,
    source: 'Style Guide',
  },
];

const mockVersions: Version[] = [
  { id: 'v1', version: '3.2', author: 'Sarah Chen', timestamp: '10 minutes ago', changes: 5, label: 'Current' },
  { id: 'v2', version: '3.1', author: 'Mike Johnson', timestamp: '2 hours ago', changes: 12 },
  { id: 'v3', version: '3.0', author: 'Lisa Park', timestamp: '1 day ago', changes: 28, label: 'Legal Review' },
  { id: 'v4', version: '2.0', author: 'Sarah Chen', timestamp: '3 days ago', changes: 45, label: 'Initial Draft' },
];

export function SmartDraftingCanvas() {
  const [content, setContent] = useState(`MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is entered into as of [DATE] by and between:

[COMPANY NAME], a corporation organized under the laws of [STATE], with its principal place of business at [ADDRESS] ("Company")

and

[VENDOR NAME], a corporation organized under the laws of [STATE], with its principal place of business at [ADDRESS] ("Vendor")

1. SERVICES

1.1 Scope of Services. Vendor agrees to provide the services described in each Statement of Work ("SOW") executed under this Agreement. Each SOW shall reference this Agreement and be subject to its terms.

1.2 Performance Standards. Vendor shall perform all Services in a professional and workmanlike manner, consistent with industry standards and practices.

2. FEES AND PAYMENT

2.1 Fees. Company shall pay Vendor the fees set forth in the applicable SOW.

2.2 Payment Terms. Unless otherwise specified in a SOW, all invoices shall be due and payable within forty-five (45) days of receipt.

3. LIABILITY

3.1 Limitation of Liability. The Vendor shall be liable for all damages arising from the performance of services under this Agreement.

4. TERM AND TERMINATION

4.1 Term. This Agreement shall commence on the Effective Date and continue for a period of one (1) year, unless earlier terminated.

4.2 Termination for Cause. Either party may terminate this Agreement for material breach upon thirty (30) days written notice.

5. DATA PROTECTION

5.1 Data Handling. Vendor shall maintain appropriate data handling procedures for all Company data accessed during performance of Services.

6. CONFIDENTIALITY

6.1 Confidential Information. Each party agrees to maintain the confidentiality of the other party's Confidential Information and to use reasonable efforts to prevent unauthorized disclosure.

7. INTELLECTUAL PROPERTY

7.1 Ownership. All intellectual property developed under this Agreement shall be jointly owned by both parties.

8. GENERAL PROVISIONS

8.1 Governing Law. This Agreement shall be governed by the laws of the State of [STATE].

8.2 Entire Agreement. This Agreement constitutes the entire agreement between the parties.`);

  const [activeTab, setActiveTab] = useState<'edit' | 'suggestions' | 'comments' | 'versions'>('edit');
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(true);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  const getSuggestionIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'risk':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'compliance':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'clarity':
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      case 'improvement':
        return <Sparkles className="h-4 w-4 text-purple-500" />;
    }
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
    const newContent = content.slice(0, suggestion.position.start) +
      suggestion.suggestedText +
      content.slice(suggestion.position.end);
    setContent(newContent);
    setSelectedSuggestion(null);
  };

  const handleAIAssist = useCallback(() => {
    // Mock AI assistance
    console.log('AI Assist:', aiPrompt);
    setAiPrompt('');
    setShowAIPanel(false);
  }, [aiPrompt]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">Master Services Agreement</h1>
                  <p className="text-xs text-gray-500">Acme Corporation • Draft v3.2</p>
                </div>
              </div>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Auto-saved 2 min ago</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Collaborators */}
              <div className="relative">
                <button
                  onClick={() => setShowCollaborators(!showCollaborators)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex -space-x-2">
                    {mockCollaborators.slice(0, 3).map((collab) => (
                      <div
                        key={collab.id}
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white"
                        style={{ backgroundColor: collab.color }}
                        title={collab.name}
                      >
                        {collab.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">{mockCollaborators.length}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                <AnimatePresence>
                  {showCollaborators && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2"
                    >
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-700">Active Collaborators</p>
                      </div>
                      {mockCollaborators.map((collab) => (
                        <div key={collab.id} className="px-3 py-2 flex items-center gap-3 hover:bg-gray-50">
                          <div className="relative">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                              style={{ backgroundColor: collab.color }}
                            >
                              {collab.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            {collab.isActive && (
                              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{collab.name}</p>
                            <p className="text-xs text-gray-500">
                              {collab.isActive ? 'Editing now' : `Last seen ${collab.lastSeen}`}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="mt-2 px-3 py-2 border-t border-gray-100">
                        <button className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                          <Share2 className="h-4 w-4" />
                          Invite collaborators
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setIsEditing(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isEditing ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    !isEditing ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Actions */}
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                <Download className="h-5 w-5" />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>

          {/* Toolbar */}
          {isEditing && (
            <div className="mt-3 flex items-center gap-1 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50">
                <button className="p-1.5 rounded hover:bg-gray-200 transition-colors" title="Undo">
                  <Undo2 className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-200 transition-colors" title="Redo">
                  <Redo2 className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Bold">
                  <Bold className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Italic">
                  <Italic className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Underline">
                  <Underline className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Heading 1">
                  <Heading1 className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Heading 2">
                  <Heading2 className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Quote">
                  <Quote className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Bullet List">
                  <List className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Align Left">
                  <AlignLeft className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Align Center">
                  <AlignCenter className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Align Right">
                  <AlignRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Insert Link">
                  <Link2 className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Insert Image">
                  <ImageIcon className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Insert Table">
                  <Table className="h-4 w-4 text-gray-600" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" title="Insert Code">
                  <Code className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-colors text-sm"
              >
                <Wand2 className="h-4 w-4" />
                AI Assist
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Editor */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            {/* AI Panel */}
            <AnimatePresence>
              {showAIPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-2">AI Writing Assistant</h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Ask AI to help... (e.g., 'Strengthen the liability clause', 'Add GDPR compliance language')"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <button
                            onClick={handleAIAssist}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            Generate
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['Improve clarity', 'Check compliance', 'Strengthen terms', 'Add standard clause', 'Simplify language'].map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => setAiPrompt(suggestion)}
                              className="px-3 py-1 text-sm bg-white text-purple-700 rounded-full hover:bg-purple-100 transition-colors border border-purple-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAIPanel(false)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Document Content */}
            <div
              ref={editorRef}
              className={`bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[800px] ${
                isEditing ? 'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent' : ''
              }`}
            >
              {isEditing ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full min-h-[750px] resize-none focus:outline-none font-serif text-gray-900 leading-relaxed"
                  style={{ fontFamily: 'Georgia, serif' }}
                />
              ) : (
                <div className="prose prose-lg max-w-none font-serif" style={{ fontFamily: 'Georgia, serif' }}>
                  {content.split('\n').map((paragraph, index) => (
                    <p key={index} className={paragraph.startsWith('#') ? 'font-bold text-xl mt-6' : ''}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 min-h-[calc(100vh-120px)]">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            {[
              { id: 'suggestions', icon: Lightbulb, label: 'AI Suggestions', count: mockSuggestions.length },
              { id: 'comments', icon: MessageSquare, label: 'Comments', count: mockComments.filter(c => !c.resolved).length },
              { id: 'versions', icon: History, label: 'History', count: null },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.count !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            {activeTab === 'suggestions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">AI Suggestions</h3>
                  <button className="text-sm text-blue-600 hover:text-blue-700">
                    Apply All Safe
                  </button>
                </div>
                {mockSuggestions.map((suggestion) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedSuggestion === suggestion.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    onClick={() => setSelectedSuggestion(selectedSuggestion === suggestion.id ? null : suggestion.id)}
                  >
                    <div className="flex items-start gap-2">
                      {getSuggestionIcon(suggestion.type)}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{suggestion.text}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{suggestion.source}</p>
                        
                        <AnimatePresence>
                          {selectedSuggestion === suggestion.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 space-y-2"
                            >
                              <div className="p-2 bg-red-50 rounded text-xs text-red-700 line-through">
                                {suggestion.originalText}
                              </div>
                              <div className="p-2 bg-green-50 rounded text-xs text-green-700">
                                {suggestion.suggestedText}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApplySuggestion(suggestion);
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                                >
                                  Apply
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSuggestion(null);
                                  }}
                                  className="flex-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="text-xs text-gray-400">
                        {Math.round(suggestion.confidence * 100)}%
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-4">
                {/* Add Comment */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                {/* Comments List */}
                {mockComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-3 rounded-lg border ${
                      comment.resolved ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                        {comment.author.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{comment.author}</span>
                          <span className="text-xs text-gray-400">{comment.timestamp}</span>
                          {comment.resolved && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{comment.content}</p>
                        
                        {comment.replies.length > 0 && (
                          <div className="mt-3 space-y-2 pl-3 border-l-2 border-gray-100">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="text-sm">
                                <span className="font-medium text-gray-900">{reply.author}</span>
                                <span className="text-gray-400 mx-1">·</span>
                                <span className="text-gray-400 text-xs">{reply.timestamp}</span>
                                <p className="text-gray-600 mt-0.5">{reply.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2">
                          <button className="text-xs text-gray-500 hover:text-gray-700">Reply</button>
                          {!comment.resolved && (
                            <button className="text-xs text-green-600 hover:text-green-700">Resolve</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'versions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">Version History</h3>
                  <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                    <GitBranch className="h-4 w-4" />
                    Compare
                  </button>
                </div>
                {mockVersions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">v{version.version}</span>
                          {version.label && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              version.label === 'Current' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {version.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{version.author}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{version.timestamp}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {version.changes} changes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
