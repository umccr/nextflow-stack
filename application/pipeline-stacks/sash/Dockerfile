FROM docker.io/continuumio/miniconda3:23.10.0-1

# Set package versions and other info
# Generic
ARG JQ_VERSION="1.6"
ARG NEXTFLOW_VERSION="25.04.3"
ARG OPENJDK_VERSION="17.0.10"
ARG PARALLEL_VERSION="20230322"
ARG RCLONE_VERSION="1.62.2"

# Docker packages
ARG DEBIAN_PLATFORM_VERSION="debian.11~bullseye_amd64"
ARG CONTAINERD_IO_VERSION="1.6.18-1"
ARG DOCKER_BUILDX_VERSION="0.10.2-1"
ARG DOCKER_CE_CLI_VERSION="23.0.1-1"
ARG DOCKER_CE_VERSION="23.0.1-1"
ARG DOCKER_COMPOSE_VERSION="2.16.0-1"

# Pipeline GH URL and branch/tag
ARG PIPELINE_GITHUB_REF  // NOTE(SW): must be provided as build argument
ARG PIPELINE_GITHUB_REPO_URL="https://github.com/scwatts/sash.git"

RUN \
  test -n "${PIPELINE_GITHUB_REF}" || (echo "PIPELINE_GITHUB_REF must be set" && false)

# Configure Conda
RUN \
  conda install --yes \
    conda-libmamba-solver && \
  echo '\
solver: libmamba\n\
channels:\n\
  - conda-forge\n\
  - bioconda\n\
  - defaults\n\
' > ~/.condarc

# Install software with apt
RUN \
  apt update -y -q && \
  apt install -y -q \
    curl \
    jq="${JQ_VERSION}*" \
    unzip \
    wget && \
  apt clean -y -q

# Install packages with Conda
RUN \
  conda install --yes \
    "nextflow ==${NEXTFLOW_VERSION}" \
    "openjdk ==${OPENJDK_VERSION}" \
    "parallel ==${PARALLEL_VERSION}" \
    "rclone ==${RCLONE_VERSION}" && \
  conda clean --all --force-pkgs-dirs --yes

# Install AWS CLIv2
RUN \
  wget --quiet 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' \
    --output-document "awscli.zip" && \
  unzip -qq "awscli.zip" && \
  ./aws/install && \
  rm -rf aws/ "awscli.zip"

# Install Docker; used to run additional containers via the host service
RUN \
  mkdir -p "docker_install_temp/" && \
  ( \
    cd "docker_install_temp/" && \
    parallel --jobs 0 " \
        wget \
          --quiet \
          'https://download.docker.com/linux/debian/dists/bullseye/pool/stable/amd64/{}' \
      " ::: \
      "containerd.io_${CONTAINERD_IO_VERSION}_amd64.deb" \
      "docker-ce_${DOCKER_CE_VERSION}~${DEBIAN_PLATFORM_VERSION}.deb" \
      "docker-ce-cli_${DOCKER_CE_CLI_VERSION}~${DEBIAN_PLATFORM_VERSION}.deb" \
      "docker-buildx-plugin_${DOCKER_BUILDX_VERSION}~${DEBIAN_PLATFORM_VERSION}.deb" \
      "docker-compose-plugin_${DOCKER_COMPOSE_VERSION}~${DEBIAN_PLATFORM_VERSION}.deb" && \
    apt install --yes --quiet $(pwd)/*.deb \
  ) && \
  rm --force --recursive "docker_install_temp/" && \
  apt clean --yes --quiet

# Install pipeline software and config
RUN \
  mkdir -p "/root/pipeline/software/" && \
  mkdir -p "/root/pipeline/assets/" && \
  ( \
    cd "/root/pipeline/software/" && \
    git clone --branch "${PIPELINE_GITHUB_REF}" "${PIPELINE_GITHUB_REPO_URL}" \
  )

COPY assets/nextflow_aws.template.config /root/pipeline/assets/
COPY assets/run.sh /root/pipeline/assets/
COPY assets/run-v2.sh /root/pipeline/assets/

RUN \
  chmod +x "/root/pipeline/assets/run.sh" && \
  chmod +x "/root/pipeline/assets/run-v2.sh"

WORKDIR /root/pipeline/
