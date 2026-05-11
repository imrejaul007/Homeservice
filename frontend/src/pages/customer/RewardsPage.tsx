import React from 'react';
import { Link } from 'react-router-dom';
import { Gift, ArrowLeft, Award, TrendingUp, Zap, Crown } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Breadcrumb from '../../components/common/Breadcrumb';

const RewardsPage: React.FC = () => {
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
          <div className="bg-gradient-to-r from-yellow-500 to-orange-600 px-8 py-12 text-white text-center">
            <div className="w-24 h-24 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
              <Gift className="h-12 w-12 text-yellow-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Rewards & Loyalty</h1>
            <p className="text-yellow-100">Earn points, unlock perks, and get exclusive rewards</p>
          </div>

          {/* Coming Soon Section */}
          <div className="px-8 py-12">
            <div className="text-center mb-12">
              <div className="inline-block p-4 bg-yellow-50 rounded-full mb-4">
                <Crown className="h-12 w-12 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Coming Soon!</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                We're creating an exciting rewards program to thank you for your loyalty.
                Earn points with every booking and unlock amazing benefits.
              </p>
            </div>

            {/* Planned Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Award className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Loyalty Points</h3>
                    <p className="text-sm text-gray-600">Earn points with every booking and service</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Crown className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Tier System</h3>
                    <p className="text-sm text-gray-600">Bronze, Silver, Gold, Platinum membership tiers</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Exclusive Discounts</h3>
                    <p className="text-sm text-gray-600">Member-only deals and priority booking</p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Zap className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Referral Bonuses</h3>
                    <p className="text-sm text-gray-600">Invite friends and earn bonus points</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Info */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Zap className="h-5 w-5 text-yellow-600 mr-2" />
                How It Will Work
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span>Earn 10 points for every $1 spent on services</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span>Redeem points for discounts on future bookings</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span>Unlock higher tiers for better perks and benefits</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span>Get birthday bonuses and anniversary rewards</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/customer/dashboard"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Dashboard
              </Link>
              <Link
                to="/customer/bookings"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <Gift className="mr-2 h-5 w-5" />
                Start Earning Points
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsPage;
