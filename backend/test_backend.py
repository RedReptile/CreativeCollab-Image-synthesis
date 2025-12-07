"""
Simple script to test if the backend is running and SPADE is available
"""
import requests
import sys

def test_backend():
    base_url = "http://localhost:5000"
    
    print("Testing backend connection...")
    
    # Test root endpoint
    try:
        response = requests.get(f"{base_url}/", timeout=5)
        print(f"✓ Root endpoint: {response.status_code}")
        print(f"  Response: {response.json()}")
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to backend. Is the server running?")
        print("  Run: cd backend && python app.py")
        return False
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return False
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"✓ Health endpoint: {response.status_code}")
        print(f"  Response: {response.json()}")
    except Exception as e:
        print(f"✗ Health check failed: {str(e)}")
        return False
    
    print("\n✓ Backend is running and accessible!")
    return True

if __name__ == "__main__":
    success = test_backend()
    sys.exit(0 if success else 1)

