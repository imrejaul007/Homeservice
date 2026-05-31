import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Book,
  Users,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Play,
  FileText,
  Award,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Star,
  Target,
  Trophy,
  Calendar,
  Video,
  FileCheck,
  Clock3,
  UserCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // minutes
  modules: number;
  lessons: number;
  quizzes: number;
  required: boolean;
  certifications: string[];
  enrolledCount: number;
  completionRate: number;
  avgScore: number;
  thumbnail?: string;
}

interface ProviderProgress {
  providerId: string;
  providerName: string;
  enrolledCourses: Array<{
    courseId: string;
    courseTitle: string;
    progress: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'failed';
    score?: number;
    startedAt: string;
    completedAt?: string;
    lastAccessedAt: string;
    timeSpent: number; // minutes
  }>;
  totalCompleted: number;
  totalInProgress: number;
  avgScore: number;
  certifications: string[];
}

interface TrainingStats {
  totalCourses: number;
  totalProviders: number;
  totalEnrollments: number;
  totalCompletions: number;
  avgCompletionRate: number;
  avgQuizScore: number;
  certificationsIssued: number;
  byCategory: Array<{ category: string; courses: number; avgCompletion: number }>;
  completionTrend: Array<{ date: string; completions: number; enrollments: number }>;
  topPerformers: Array<{ providerId: string; providerName: string; completions: number; avgScore: number }>;
  quizScoreDistribution: Array<{ range: string; count: number }>;
}

interface TrainingAcademyProps {
  embedded?: boolean;
  onClose?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Safety': '#EF4444',
  'Customer Service': '#3B82F6',
  'Technical': '#10B981',
  'Compliance': '#8B5CF6',
  'Sales': '#F59E0B',
  'Soft Skills': '#EC4899'
};

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Beginner', color: 'bg-green-100 text-green-700' },
  intermediate: { label: 'Intermediate', color: 'bg-amber-100 text-amber-700' },
  advanced: { label: 'Advanced', color: 'bg-red-100 text-red-700' }
};

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' }
};

export const TrainingAcademy: React.FC<TrainingAcademyProps> = ({
  embedded = false,
  onClose
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [providerProgress, setProviderProgress] = useState<ProviderProgress[]>([]);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [view, setView] = useState<'courses' | 'providers'>('courses');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/training-academy');

      if (response.data?.success) {
        setCourses(response.data.data.courses || []);
        setProviderProgress(response.data.data.providerProgress || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setCourses([
          {
            id: 'course-001',
            title: 'Safety & Emergency Protocols',
            description: 'Learn essential safety procedures, emergency response protocols, and workplace hazard identification.',
            category: 'Safety',
            difficulty: 'beginner',
            duration: 120,
            modules: 4,
            lessons: 12,
            quizzes: 2,
            required: true,
            certifications: ['Safety Certificate'],
            enrolledCount: 234,
            completionRate: 87,
            avgScore: 85
          },
          {
            id: 'course-002',
            title: 'Customer Service Excellence',
            description: 'Master the art of exceptional customer service, communication skills, and conflict resolution.',
            category: 'Customer Service',
            difficulty: 'intermediate',
            duration: 180,
            modules: 5,
            lessons: 18,
            quizzes: 3,
            required: true,
            certifications: ['Customer Service Badge'],
            enrolledCount: 198,
            completionRate: 78,
            avgScore: 82
          },
          {
            id: 'course-003',
            title: 'Electrical Safety Standards',
            description: 'Comprehensive training on electrical safety, proper tool usage, and compliance requirements.',
            category: 'Technical',
            difficulty: 'advanced',
            duration: 240,
            modules: 6,
            lessons: 24,
            quizzes: 4,
            required: true,
            certifications: ['Electrical Safety License', 'Technical Competency Badge'],
            enrolledCount: 156,
            completionRate: 72,
            avgScore: 79
          },
          {
            id: 'course-004',
            title: 'Data Privacy & GDPR Compliance',
            description: 'Understand data protection regulations, privacy best practices, and compliance requirements.',
            category: 'Compliance',
            difficulty: 'beginner',
            duration: 90,
            modules: 3,
            lessons: 9,
            quizzes: 2,
            required: true,
            certifications: ['Data Privacy Certificate'],
            enrolledCount: 312,
            completionRate: 91,
            avgScore: 88
          },
          {
            id: 'course-005',
            title: 'Effective Sales Techniques',
            description: 'Learn upselling, cross-selling, and conversion optimization strategies for service providers.',
            category: 'Sales',
            difficulty: 'intermediate',
            duration: 150,
            modules: 4,
            lessons: 15,
            quizzes: 2,
            required: false,
            certifications: ['Sales Pro Badge'],
            enrolledCount: 145,
            completionRate: 65,
            avgScore: 76
          },
          {
            id: 'course-006',
            title: 'Professional Communication',
            description: 'Develop professional communication skills for client interactions, emails, and phone calls.',
            category: 'Soft Skills',
            difficulty: 'beginner',
            duration: 60,
            modules: 2,
            lessons: 8,
            quizzes: 1,
            required: false,
            certifications: [],
            enrolledCount: 267,
            completionRate: 82,
            avgScore: 84
          }
        ]);
        setProviderProgress([
          {
            providerId: 'prov-001',
            providerName: 'Ahmed Al-Rashid',
            enrolledCourses: [
              { courseId: 'course-001', courseTitle: 'Safety & Emergency Protocols', progress: 100, status: 'completed', score: 92, startedAt: '2024-01-15', completedAt: '2024-01-20', lastAccessedAt: '2024-01-20', timeSpent: 115 },
              { courseId: 'course-002', courseTitle: 'Customer Service Excellence', progress: 65, status: 'in_progress', startedAt: '2024-01-25', lastAccessedAt: '2024-02-01', timeSpent: 78 },
              { courseId: 'course-003', courseTitle: 'Electrical Safety Standards', progress: 30, status: 'in_progress', startedAt: '2024-02-05', lastAccessedAt: '2024-02-10', timeSpent: 45 }
            ],
            totalCompleted: 1,
            totalInProgress: 2,
            avgScore: 92,
            certifications: ['Safety Certificate']
          },
          {
            providerId: 'prov-002',
            providerName: 'Fatima Hassan',
            enrolledCourses: [
              { courseId: 'course-001', courseTitle: 'Safety & Emergency Protocols', progress: 100, status: 'completed', score: 88, startedAt: '2024-01-10', completedAt: '2024-01-18', lastAccessedAt: '2024-01-18', timeSpent: 110 },
              { courseId: 'course-002', courseTitle: 'Customer Service Excellence', progress: 100, status: 'completed', score: 85, startedAt: '2024-01-20', completedAt: '2024-02-01', lastAccessedAt: '2024-02-01', timeSpent: 175 },
              { courseId: 'course-004', courseTitle: 'Data Privacy & GDPR Compliance', progress: 100, status: 'completed', score: 94, startedAt: '2024-02-05', completedAt: '2024-02-08', lastAccessedAt: '2024-02-08', timeSpent: 85 }
            ],
            totalCompleted: 3,
            totalInProgress: 0,
            avgScore: 89,
            certifications: ['Safety Certificate', 'Customer Service Badge', 'Data Privacy Certificate']
          },
          {
            providerId: 'prov-003',
            providerName: 'Omar Malik',
            enrolledCourses: [
              { courseId: 'course-001', courseTitle: 'Safety & Emergency Protocols', progress: 45, status: 'in_progress', startedAt: '2024-02-01', lastAccessedAt: '2024-02-08', timeSpent: 35 }
            ],
            totalCompleted: 0,
            totalInProgress: 1,
            avgScore: 0,
            certifications: []
          }
        ]);
        setStats({
          totalCourses: 12,
          totalProviders: 156,
          totalEnrollments: 423,
          totalCompletions: 312,
          avgCompletionRate: 73.8,
          avgQuizScore: 82.5,
          certificationsIssued: 289,
          byCategory: [
            { category: 'Safety', courses: 3, avgCompletion: 82 },
            { category: 'Customer Service', courses: 2, avgCompletion: 78 },
            { category: 'Technical', courses: 4, avgCompletion: 72 },
            { category: 'Compliance', courses: 2, avgCompletion: 91 },
            { category: 'Sales', courses: 1, avgCompletion: 65 }
          ],
          completionTrend: [
            { date: 'Week 1', completions: 45, enrollments: 62 },
            { date: 'Week 2', completions: 52, enrollments: 68 },
            { date: 'Week 3', completions: 48, enrollments: 55 },
            { date: 'Week 4', completions: 61, enrollments: 72 },
            { date: 'Week 5', completions: 55, enrollments: 65 },
            { date: 'Week 6', completions: 51, enrollments: 58 }
          ],
          topPerformers: [
            { providerId: 'prov-002', providerName: 'Fatima Hassan', completions: 3, avgScore: 89 },
            { providerId: 'prov-001', providerName: 'Ahmed Al-Rashid', completions: 1, avgScore: 92 },
            { providerId: 'prov-005', providerName: 'Sara Khan', completions: 3, avgScore: 85 }
          ],
          quizScoreDistribution: [
            { range: '0-40%', count: 12 },
            { range: '41-60%', count: 28 },
            { range: '61-80%', count: 89 },
            { range: '81-100%', count: 183 }
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching training academy data:', err);
      setError('Failed to load training academy data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    const matchesDifficulty = difficultyFilter === 'all' || course.difficulty === difficultyFilter;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const uniqueCategories = [...new Set(courses.map(c => c.category))];

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <GraduationCap className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Training Academy</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Training Academy</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Provider courses & progress tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-nilin-border overflow-hidden">
            <button
              onClick={() => setView('courses')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                view === 'courses' ? 'bg-nilin-coral text-white' : 'hover:bg-nilin-blush/30'
              )}
            >
              <Book className="w-4 h-4 inline mr-2" />
              Courses
            </button>
            <button
              onClick={() => setView('providers')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                view === 'providers' ? 'bg-nilin-coral text-white' : 'hover:bg-nilin-blush/30'
              )}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Providers
            </button>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <XCircle className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Book className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalCourses || 0}</p>
          <p className="text-xs text-nilin-warmGray">Courses</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Users className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalProviders || 0}</p>
          <p className="text-xs text-nilin-warmGray">Providers</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.totalCompletions || 0}</p>
          <p className="text-xs text-nilin-warmGray">Completions</p>
        </div>
        <div className="glass rounded-xl border border-purple-200/50 p-4 text-center">
          <Award className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.certificationsIssued || 0}</p>
          <p className="text-xs text-nilin-warmGray">Certifications</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Completion Rate</span>
            <span className="text-lg font-serif text-green-600">{stats?.avgCompletionRate || 0}%</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Avg. Quiz Score</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.avgQuizScore || 0}%</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Total Enrollments</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.totalEnrollments || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Top Score</span>
            <span className="text-lg font-serif text-amber-600">94%</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Completion Trend */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Completion Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.completionTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Area type="monotone" dataKey="enrollments" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} name="Enrollments" />
                <Area type="monotone" dataKey="completions" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Completions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quiz Score Distribution */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Quiz Score Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.quizScoreDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="range" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="count" fill="#8B5CF6" name="Providers" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      {view === 'courses' && (
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses..."
              className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      )}

      {/* Courses Grid */}
      {view === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map(course => {
            const difficultyConfig = DIFFICULTY_CONFIG[course.difficulty];
            const categoryColor = CATEGORY_COLORS[course.category] || '#6B7280';

            return (
              <div
                key={course.id}
                className="glass rounded-xl border border-nilin-border/50 p-4 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedCourse(selectedCourse?.id === course.id ? null : course)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${categoryColor}20` }}>
                    <Book className="w-6 h-6" style={{ color: categoryColor }} />
                  </div>
                  <div className="flex items-center gap-2">
                    {course.required && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                        Required
                      </span>
                    )}
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', difficultyConfig.color)}>
                      {difficultyConfig.label}
                    </span>
                  </div>
                </div>
                <h3 className="font-medium text-nilin-charcoal mb-2">{course.title}</h3>
                <p className="text-sm text-nilin-warmGray mb-3 line-clamp-2">{course.description}</p>
                <div className="flex items-center gap-4 text-xs text-nilin-warmGray mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {course.duration} min
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {course.lessons} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <FileCheck className="w-3 h-3" />
                    {course.quizzes} quizzes
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-nilin-warmGray">Completion Rate</span>
                    <span className="font-medium text-nilin-charcoal">{course.completionRate}%</span>
                  </div>
                  <div className="h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${course.completionRate}%`, backgroundColor: categoryColor }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-nilin-warmGray">{course.enrolledCount} enrolled</span>
                    <span className="text-xs text-nilin-warmGray">Avg: {course.avgScore}%</span>
                  </div>
                </div>

                {selectedCourse?.id === course.id && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Certifications</h4>
                    <div className="flex flex-wrap gap-1">
                      {course.certifications.length > 0 ? course.certifications.map(cert => (
                        <span key={cert} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                          <Award className="w-3 h-3 inline mr-1" />
                          {cert}
                        </span>
                      )) : (
                        <span className="text-xs text-nilin-warmGray">No certifications</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Providers Table */}
      {view === 'providers' && (
        <div className="space-y-4">
          <div className="text-sm text-nilin-warmGray">
            <Users className="w-4 h-4 inline mr-2" />
            {providerProgress.length} providers enrolled in training
          </div>
          {providerProgress.map(provider => (
            <div key={provider.providerId} className="glass rounded-xl border border-nilin-border/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-nilin-charcoal">{provider.providerName}</h3>
                  <div className="flex items-center gap-4 text-xs text-nilin-warmGray mt-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {provider.totalCompleted} completed
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="w-3 h-3 text-blue-500" />
                      {provider.totalInProgress} in progress
                    </span>
                    {provider.avgScore > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500" />
                        {provider.avgScore}% avg score
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {provider.certifications.map(cert => (
                    <span key={cert} className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs">
                      <Award className="w-3 h-3 inline mr-1" />
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {provider.enrolledCourses.map(course => {
                  const statusConfig = STATUS_CONFIG[course.status];
                  return (
                    <div key={course.courseId} className="flex items-center gap-3 p-2 bg-nilin-blush/20 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-nilin-charcoal">{course.courseTitle}</span>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="h-2 bg-white rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full transition-all"
                            style={{ width: `${course.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal w-12 text-right">{course.progress}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Performers */}
      <div className="mt-6 glass rounded-xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Top Performers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats?.topPerformers.map((performer, idx) => (
            <div key={performer.providerId} className={cn(
              'p-4 rounded-xl border',
              idx === 0 ? 'bg-amber-50 border-amber-200' :
              idx === 1 ? 'bg-gray-50 border-gray-200' :
              'bg-orange-50 border-orange-200'
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  idx === 0 ? 'bg-amber-200' :
                  idx === 1 ? 'bg-gray-300' :
                  'bg-orange-200'
                )}>
                  <Trophy className={cn(
                    'w-5 h-5',
                    idx === 0 ? 'text-amber-600' :
                    idx === 1 ? 'text-gray-600' :
                    'text-orange-600'
                  )} />
                </div>
                <div>
                  <p className="font-medium text-nilin-charcoal">{performer.providerName}</p>
                  <div className="flex items-center gap-2 text-xs text-nilin-warmGray">
                    <span>{performer.completions} courses</span>
                    <span>•</span>
                    <span>{performer.avgScore}% avg</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrainingAcademy;
