#include <iostream>

using namespace std;

int main(){
    int n; cin >> n;
    int y = 0;

    for (int i = n; i <= 1000000000; ++i) {
        int x = i;
        int r = 0;
        while (x > 1) {
            if (x % 2 == 0)
                x /= 2;
            else
                x = 3 * x + 1;
            r++;
        }
        y += r;
    }

    cout << y << endl;

    return 0;
}
