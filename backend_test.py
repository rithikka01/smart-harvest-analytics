import requests
import sys
import json
from datetime import datetime

class SmartFarmingAPITester:
    def __init__(self, base_url="https://farm-intel-30.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.farm_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if success and response.content:
                try:
                    response_data = response.json()
                    details += f", Response: {json.dumps(response_data, indent=2)[:200]}..."
                    self.log_test(name, True, details)
                    return True, response_data
                except:
                    self.log_test(name, True, details)
                    return True, {}
            elif not success:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Error: {response.text[:200]}"
                self.log_test(name, False, details)
                return False, {}
            else:
                self.log_test(name, True, details)
                return True, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        test_user_data = {
            "name": f"Test Farmer {datetime.now().strftime('%H%M%S')}",
            "email": f"testfarmer{datetime.now().strftime('%H%M%S')}@example.com",
            "mobile": "+91 9876543210",
            "password": "TestPass123!",
            "language": "en"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        login_data = {
            "email": "testfarmer@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_farm_creation(self):
        """Test farm creation"""
        farm_data = {
            "name": "Test Smart Farm",
            "crop_type": "Rice",
            "field_size": 5.5,
            "location": {
                "latitude": 13.0827,
                "longitude": 80.2707,
                "address": "Chennai, Tamil Nadu"
            },
            "firebase_path": "test_farm_sensors"
        }
        
        success, response = self.run_test(
            "Farm Creation",
            "POST",
            "farms",
            200,
            data=farm_data
        )
        
        if success and 'id' in response:
            self.farm_id = response['id']
            return True
        return False

    def test_get_farms(self):
        """Test getting user farms"""
        success, response = self.run_test(
            "Get User Farms",
            "GET",
            "farms",
            200
        )
        return success

    def test_sensor_data(self):
        """Test sensor data retrieval"""
        if not self.farm_id:
            self.log_test("Sensor Data Retrieval", False, "No farm ID available")
            return False
            
        success, response = self.run_test(
            "Sensor Data Retrieval",
            "GET",
            f"farms/{self.farm_id}/sensors",
            200
        )
        
        if success:
            # Verify sensor data structure
            required_fields = ['soil_moisture', 'soil_temperature', 'ambient_temperature', 'humidity', 'light_intensity', 'status']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                self.log_test("Sensor Data Structure", False, f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Sensor Data Structure", True, "All required fields present")
                return True
        return False

    def test_weather_api(self):
        """Test weather API"""
        success, response = self.run_test(
            "Weather API",
            "GET",
            "weather?lat=13.0827&lon=80.2707",
            200
        )
        
        if success:
            # Verify weather data structure
            required_sections = ['current', 'forecast']
            missing_sections = [section for section in required_sections if section not in response]
            
            if missing_sections:
                self.log_test("Weather Data Structure", False, f"Missing sections: {missing_sections}")
                return False
            else:
                self.log_test("Weather Data Structure", True, "Weather data structure valid")
                return True
        return False

    def test_crop_health_analysis(self):
        """Test AI crop health analysis"""
        if not self.farm_id:
            self.log_test("Crop Health Analysis", False, "No farm ID available")
            return False
            
        success, response = self.run_test(
            "Crop Health Analysis",
            "POST",
            f"crop/analyze?farm_id={self.farm_id}",
            200
        )
        
        if success:
            # Verify response structure
            required_fields = ['health_status', 'confidence', 'reasons', 'recommendations']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                self.log_test("Crop Health Response Structure", False, f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Crop Health Response Structure", True, "Response structure valid")
                return True
        return False

    def test_yield_prediction(self):
        """Test AI yield prediction"""
        if not self.farm_id:
            self.log_test("Yield Prediction", False, "No farm ID available")
            return False
            
        success, response = self.run_test(
            "Yield Prediction",
            "POST",
            f"yield/predict?farm_id={self.farm_id}",
            200
        )
        
        if success:
            # Verify response structure
            required_fields = ['estimated_yield', 'unit', 'confidence']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                self.log_test("Yield Prediction Response Structure", False, f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Yield Prediction Response Structure", True, "Response structure valid")
                return True
        return False

    def test_irrigation_recommendation(self):
        """Test irrigation recommendation"""
        if not self.farm_id:
            self.log_test("Irrigation Recommendation", False, "No farm ID available")
            return False
            
        success, response = self.run_test(
            "Irrigation Recommendation",
            "POST",
            f"irrigation/recommend?farm_id={self.farm_id}",
            200
        )
        
        if success:
            # Verify response structure
            required_fields = ['should_irrigate', 'reason']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                self.log_test("Irrigation Response Structure", False, f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Irrigation Response Structure", True, "Response structure valid")
                return True
        return False

    def test_chatbot(self):
        """Test AI chatbot"""
        chatbot_data = {
            "message": "What is the best time to water rice crops?"
        }
        
        success, response = self.run_test(
            "AI Chatbot",
            "POST",
            "chatbot",
            200,
            data=chatbot_data
        )
        
        if success and 'response' in response:
            self.log_test("Chatbot Response", True, f"Response received: {response['response'][:100]}...")
            return True
        return False

    def test_alerts(self):
        """Test alerts retrieval"""
        success, response = self.run_test(
            "Get Alerts",
            "GET",
            "alerts",
            200
        )
        return success

    def test_government_schemes(self):
        """Test government schemes API"""
        success, response = self.run_test(
            "Government Schemes",
            "GET",
            "schemes",
            200
        )
        
        if success and isinstance(response, list):
            self.log_test("Schemes Response Structure", True, f"Found {len(response)} schemes")
            return True
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Smart Farming API Tests")
        print("=" * 50)
        
        # Authentication tests
        print("\n📝 Testing Authentication...")
        if not self.test_user_registration():
            print("⚠️  Registration failed, trying login...")
            if not self.test_user_login():
                print("❌ Authentication completely failed, stopping tests")
                return False
        
        # Farm management tests
        print("\n🏡 Testing Farm Management...")
        self.test_farm_creation()
        self.test_get_farms()
        
        # Sensor and weather tests
        print("\n📊 Testing Data APIs...")
        self.test_sensor_data()
        self.test_weather_api()
        
        # AI integration tests
        print("\n🤖 Testing AI Features...")
        self.test_crop_health_analysis()
        self.test_yield_prediction()
        self.test_irrigation_recommendation()
        self.test_chatbot()
        
        # Other features
        print("\n📢 Testing Additional Features...")
        self.test_alerts()
        self.test_government_schemes()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        return success_rate > 70

def main():
    tester = SmartFarmingAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
            },
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())