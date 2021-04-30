##########################################
# To run: 
# curl -sSL https://gist.githubusercontent.com/sirkkalap/e87cd580a47b180a7d32/raw/d9c9ebae4f5cf64eed4676e8aedac265b5a51bfa/Install-Docker-on-Linux-Mint.sh | bash -x
##########################################

# Check that HTTPS transport is available to APT
if [ ! -e /usr/lib/apt/methods/https ]; then
	sudo apt-get update
	sudo apt-get install -y apt-transport-https
fi

# Add the repository to your APT sources
sudo echo deb https://get.docker.com/ubuntu docker main > /etc/apt/sources.list.d/docker.list

# Then import the repository key
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9

# Install docker
sudo apt-get update
sudo apt-get install -y docker.io cgroup-lite apparmor

#
# Alternatively, just use the curl-able install.sh script provided at https://get.docker.com
#

echo Add group docker to current user
sudo usermod -a -G docker $USER