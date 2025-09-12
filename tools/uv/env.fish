if not contains "/mnt/d/SaaS_Nomation/tools/uv" $PATH
    # Prepending path in case a system-installed binary needs to be overridden
    set -x PATH "/mnt/d/SaaS_Nomation/tools/uv" $PATH
end
