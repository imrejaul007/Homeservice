import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowLeft, Star, Users, TrendingUp, Sparkles } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Breadcrumb from '../../components/common/Breadcrumb';

const FavoritesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      {/* Breadcrumb Navigation */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-red-600 px-8 py-12 text-white text-center">
            <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
              <Heart className="h-12 w-12 text-red-600 fill-current" />
            </div>
            <h1 className="text-3xl font-bold mb-2">My Favorites</h1>
            <p className="text-pink-100">Save and manage your favorite providers and services</p>
          </div>

          {/* Coming Soon Section */}
          <div className="px-8 py-12">
            <div className="text-center mb-12">
              <div className="inline-block p-4 bg-red-50 rounded-full mb-4">
                <Sparkles className="h-12 w-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Coming Soon!</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                We're building a powerful favorites system to help you keep track of your preferred providers and services.
              </p>
            </div>

            {/* Planned Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Heart className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Favorite Providers</h3>
                    <p className="text-sm text-gray-600">Save providers you love for quick access and booking</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Star className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Favorite Services</h3>
                    <p className="text-sm text-gray-600">Bookmark services you use frequently</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Collections</h3>
                    <p className="text-sm text-gray-600">Organize favorites into custom collections</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Smart Recommendations</h3>
                    <p className="text-sm text-gray-600">Get suggestions based on your favorites</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/customer/dashboard"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Dashboard
              </Link>
              <Link
                to="/search"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Heart className="mr-2 h-5 w-5" />
                Browse Services
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FavoritesPage;
